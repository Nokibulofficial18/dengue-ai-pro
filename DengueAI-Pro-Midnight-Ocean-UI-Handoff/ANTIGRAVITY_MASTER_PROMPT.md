# Antigravity master implementation prompt

You are implementing the final **DengueAI Pro Midnight Ocean** design on top of my existing codebase.

IMPORTANT REFERENCE FILES:
- `UI_DESIGN_SPEC.md` — exact technical and design requirements
- `midnight-ocean-reference.png` — definitive visual appearance reference

Read BOTH reference files and inspect the current source code BEFORE editing. My exact goal is to build a functioning website whose **desktop look closely matches the attached dashboard image**. I do not want the image simply displayed as a full-page background. Recreate the layout, visual styles, controls and data visualizations with actual React components.

My project already has React, Vite, Tailwind, React Router, Axios, Recharts and React Leaflet. Do not rewrite or replace the backend. Reuse the existing components and API routes, particularly the map, ward scores, citizen reporting, dispatch queue and RAG assistant.

Implement the full responsive dashboard and common theme with these sections:
- Midnight Ocean sidebar and navigation
- polished header with honest demo/backend state
- 4 KPI cards
- large, interactive Dhaka risk map and legend
- seven-day forecast/trend panel where supported, otherwise clearly marked demo/unavailable
- AI insights with actual source or clear demo marker
- ward priority queue using actual SWAPI/dispatch data
- recent citizen reports from a real supported endpoint or labeled demo/unavailable state
- true data freshness indicators where possible

Match the reference composition at 1672x941: sidebar approximately 260px, header ~75px, a row of 4 KPI cards, a visually dominant main map to the left, a trend chart plus AI insights on the right, and a 3-panel lower row. Maintain harmonious spacing, typographic scale, border, glow and accent colors, tuned to the image.

Colors: sidebar #0C1829; canvas #142235; raised cards #20354D; cyan #46C8E5; violet #9B83F5; readable primary text #F2F7FF; muted text #9FB3C9. Severity states red/coral, amber, teal/green. Avoid near-black UI, harsh gradients and noisy neon effects.

Keep every existing backend endpoint, request/response contract, SWAPI algorithm, report submission interaction and dispatch functionality unchanged. There are currently only a handful of existing routes (`/`, `/map`, `/wards`, `/citizen`, `/authority` in the archived snapshot); verify the current code. Do NOT create fake active links for screenshot-only menu items. Use existing pages where appropriate, add a new dashboard page and route only when needed, and preserve all original URLs.

Be careful: the current HeatMap is based on rectangular bounds, not exact ward polygons/hexagons. Do not pretend screenshot hexagons are real ward boundaries; create a legitimate geo layer only where data allows. The mockup includes fictional figures, timestamps, authenticated names, and government branding — none of these should appear as real facts, endorsements or live data. Clearly label demonstration content, or replace with real backend values.

Implement accessible hover/focus/keyboard states, loading/error/empty states, functional controls, and responsive mobile/tablet layouts. Never sacrifice readability to make it look more futuristic.

Follow the stages in `UI_DESIGN_SPEC.md` in order. Do not require my approval between stages. Leave final integrated testing and screenshot comparison to the final verification stage after all design changes are implemented. Finish with a compact change summary including changed files, routes used, real vs demo data, any remaining limitations, and instructions to run the frontend.
