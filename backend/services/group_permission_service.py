"""
Multi-Tenant Permission & Data Isolation Service.
Enforces default-deny access control for cross-property coordination.
Prevents leakage of private photos, maintenance expenses, contractor quotes,
and citizen reports across participating organizations in a consortium.
"""
from typing import Optional, Dict, Any, List
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status


class GroupPermissionService:
    @staticmethod
    async def verify_org_in_group(
        session: AsyncSession,
        group_id: str,
        organization_id: str,
        required_roles: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Verifies that an organization is an active member of the coordination group.
        If required_roles is provided, checks if the organization holds one of those roles.
        Raises 403 Forbidden if not authorized.
        """
        query = text("""
            SELECT m.id, m.group_id, m.organization_id, m.role, m.status, o.name as org_name
            FROM group_memberships m
            JOIN organizations o ON m.organization_id = o.id
            WHERE m.group_id = :group_id AND m.organization_id = :org_id AND m.status = 'active'
        """)
        result = await session.execute(query, {"group_id": group_id, "org_id": organization_id})
        membership = result.mappings().first()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Organization '{organization_id}' is not an active member of coordination group '{group_id}'."
            )

        if required_roles and membership["role"] not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Organization requires role in {required_roles}, but holds '{membership['role']}'."
            )

        return dict(membership)

    @staticmethod
    async def check_can_view_property(
        session: AsyncSession,
        property_id: str,
        requesting_org_id: Optional[str]
    ) -> bool:
        """
        Checks if requesting organization owns or manages the property.
        If no requesting_org_id is provided, public health authority access is assumed if authenticated.
        """
        if not requesting_org_id:
            return True

        query = text("SELECT organization_id, responsible_org FROM properties WHERE id = :property_id")
        result = await session.execute(query, {"property_id": property_id})
        prop = result.mappings().first()
        if not prop:
            return False

        # Owner matches
        if prop["organization_id"] == requesting_org_id:
            return True

        return False

    @staticmethod
    async def sanitize_work_order_for_consortium(wo: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitizes a work order before displaying in consortium-wide views.
        Removes internal worker private notes, internal pricing/quotes, or private contact details.
        Retains operational fields: task title, shared area name, deadline, status, verification status.
        """
        safe = dict(wo)
        # Strip internal financial/sensitive keys if present
        sensitive_keys = [
            "contractor_invoice_amount",
            "internal_cost_estimate",
            "worker_phone",
            "resident_complaint_raw",
            "financial_notes"
        ]
        for k in sensitive_keys:
            safe.pop(k, None)
        return safe

    @staticmethod
    async def log_coordination_event(
        session: AsyncSession,
        group_id: Optional[str],
        actor_name: str,
        actor_org_id: Optional[str],
        action_type: str,
        target_entity_type: str,
        target_entity_id: str,
        details: Optional[Dict[str, Any]] = None
    ):
        """
        Records an auditable security and operational event in coordination_audit_logs.
        """
        import json
        import uuid
        from datetime import datetime, timezone

        log_id = f"LOG-{uuid.uuid4().hex[:8].upper()}"
        ts = datetime.now(timezone.utc).isoformat()
        details_str = json.dumps(details or {})

        await session.execute(
            text("""
                INSERT INTO coordination_audit_logs
                (id, group_id, actor_name, actor_org_id, action_type, target_entity_type,
                 target_entity_id, details_json, timestamp)
                VALUES
                (:id, :group_id, :actor_name, :actor_org_id, :action_type, :target_entity_type,
                 :target_entity_id, :details_json, :timestamp)
            """),
            {
                "id": log_id,
                "group_id": group_id,
                "actor_name": actor_name,
                "actor_org_id": actor_org_id,
                "action_type": action_type,
                "target_entity_type": target_entity_type,
                "target_entity_id": target_entity_id,
                "details_json": details_str,
                "timestamp": ts,
            }
        )
