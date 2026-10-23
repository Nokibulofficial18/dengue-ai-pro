"""
Authority Authentication and Access Control Utility for DengueAI Pro.

IMPORTANT NOTICE:
This module provides a minimum viable authority-only access mechanism for local
development and demonstration. It enforces backend credential checking and token
validation so that sensitive property records, inspections, and hazard histories
are not exposed via public unauthenticated endpoints.

THIS IS NOT A SUBSTITUTE FOR FULL PRODUCTION ROLE-BASED ACCESS CONTROL (RBAC),
MULTI-FACTOR AUTHENTICATION, OR ENTERPRISE OIDC/OAUTH2 INFRASTRUCTURE.
"""

import base64
from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import json
import os
import secrets
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

AUTHORITY_DEV_KEY = os.getenv("AUTHORITY_DEV_KEY", "dengue-authority-dev-2026")
AUTHORITY_USERNAME = os.getenv("AUTHORITY_USERNAME", "authority")
AUTHORITY_PASSWORD = os.getenv("AUTHORITY_PASSWORD", "dengue2026")
SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "dengueai-pro-development-session-secret-key-32b")

# In-memory session store for backward compatibility: token -> user dict
ACTIVE_SESSIONS: dict[str, dict] = {}


class AuthorityUser(BaseModel):
    username: str
    display_name: str
    role: str
    agency: str


class LoginRequest(BaseModel):
    username: str
    password: str
    role: Optional[str] = "authority_officer"


class LoginResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    user: AuthorityUser
    expires_in_hours: int = 24


def verify_authority_credentials(username: str, password: str, requested_role: Optional[str] = None) -> Optional[AuthorityUser]:
    """Verify local development credentials against environment configuration."""
    is_user_match = secrets.compare_digest(username.strip(), AUTHORITY_USERNAME.strip())
    is_pass_match = secrets.compare_digest(password.strip(), AUTHORITY_PASSWORD.strip())

    role_titles = {
        "supervisor": "DNCC Field Operations Supervisor",
        "worker": "Authorized Field Vector Contractor",
        "property_manager": "Registered Property Facility Manager",
        "inspector": "DNCC Quality Assurance Health Inspector",
        "authority_officer": "DNCC Municipal Authority Inspector",
        "maintenance_assessor": "Qualified Maintenance Systems Engineer",
        "finance_approver": "Authorized Facility Finance & Capital Approver",
    }

    if is_user_match and is_pass_match:
        role = requested_role or "authority_officer"
        return AuthorityUser(
            username=AUTHORITY_USERNAME,
            display_name=role_titles.get(role, "DNCC Municipal Authority Officer"),
            role=role,
            agency="Dhaka North City Corporation (Health & Vector Control)",
        )
    return None


def create_session(user: AuthorityUser) -> str:
    """
    Generate a stateless HMAC-signed session token for the authenticated authority user.
    Stateless signed tokens persist across server restarts, redeployments, and
    multi-process workers without requiring in-memory session synchronization.
    """
    payload = {
        "user": user.model_dump(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "nonce": secrets.token_hex(8),
    }
    payload_json = json.dumps(payload, separators=(',', ':'))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
    token = f"auth_{payload_b64}.{signature}"

    # Also record in memory for local debug / backward compatibility
    ACTIVE_SESSIONS[token] = payload
    return token


def decode_signed_token(token_str: str) -> Optional[AuthorityUser]:
    """Verify and decode a stateless HMAC-signed session token."""
    if not token_str.startswith("auth_"):
        return None
    token_body = token_str[5:]
    if "." in token_body:
        payload_b64, signature = token_body.split(".", 1)
        expected_sig = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), hashlib.sha256).hexdigest()
        if secrets.compare_digest(signature, expected_sig):
            try:
                payload_json = base64.urlsafe_b64decode(payload_b64.encode()).decode()
                data = json.loads(payload_json)
                return AuthorityUser(**data["user"])
            except Exception:
                return None
    return None


async def get_current_authority_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
    x_authority_key: Optional[str] = Header(None, alias="X-Authority-Key"),
) -> AuthorityUser:
    """
    FastAPI dependency that enforces authority authentication on protected endpoints.
    Accepts:
      1. Authorization: Bearer <signed_token_or_dev_key>
      2. X-Authority-Key: <signed_token_or_dev_key>
    """
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
        elif len(parts) == 1:
            token = parts[0]

    key_candidate = x_authority_key or token

    # 1. Check direct dev key (configured via environment or default)
    if key_candidate and secrets.compare_digest(key_candidate, AUTHORITY_DEV_KEY):
        return AuthorityUser(
            username="authority_key_holder",
            display_name="Authorized Municipal Officer",
            role="authority_officer",
            agency="DNCC Vector Control Division",
        )

    # 2. Check stateless signed token
    if key_candidate:
        signed_user = decode_signed_token(key_candidate)
        if signed_user:
            return signed_user

    # 3. Check active in-memory session token fallback
    if key_candidate and key_candidate in ACTIVE_SESSIONS:
        session_data = ACTIVE_SESSIONS[key_candidate]
        return AuthorityUser(**session_data["user"])

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=(
            "Authority authentication required to access permanent hazard location records. "
            "Please provide a valid Authority Session Bearer token or X-Authority-Key header."
        ),
        headers={"WWW-Authenticate": "Bearer"},
    )

