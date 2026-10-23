# DengueAI Pro — Midnight Ocean UI/UX implementation specification

## The primary goal
Rebuild the UI/UX of the **existing working DengueAI Pro React website**, following `midnight-ocean-reference.png` as the **visual source of truth**. Match the reference as closely as possible at the original mockup's 1672x941 viewport, while making the real website fully responsive and keeping the existing workflow, navigation, frontend API calls, and backend functionality intact. This is a coded interface, NOT an image displayed as a full-page background.

## Existing project: verified against uploaded ZIP (2026-06-08 archive snapshot)
- `frontend/src/App.jsx` holds the current global top navigation and routes.
- Existing routes: `/` (landing page in `pages/Demo.jsx`), `/map` (`pages/Home.jsx`), `/wards` (`pages/Wards.jsx`), `/citizen` (`pages/Citizen.jsx`), `/authority` (`pages/Authority.jsx`).
- Frontend is React 18 + Vite 5, Tailwind 3, react-router-dom 6, recharts 2, react-leaflet 4 + leaflet, axios.
- Relevant components: `components/HeatMap.jsx`, `StatsBar.jsx`, `WardCard.jsx`, `CitizenReport.jsx`, `DispatchDashboard.jsx`, `LLMChat.jsx`.
- Backend is FastAPI with routes for SWAPI, heatmap wards, citizen reporting, dispatch, RAG. Inspect actual current endpoint contracts before binding data.
- Current `HeatMap.jsx` renders Leaflet `Rectangle` objects using `ward.bounds` from `/api/heatmap/wards`. It does not provide real ward polygon GeoJSON or hexagon vector data.
- `StatsBar.jsx` includes a hardcoded 2023 case counter. Remove misleading 'live' treatment, do not extrapolate it.
- `index.css` and `App.jsx` have existing styles and hardcoded #0b1220; convert to a consistent theme system rather than layering conflicting overrides.

**IMPORTANT:** The uploaded ZIP is a snapshot. Use the user's **latest on-disk codebase** as authority; adapt all instructions when current project code differs.

## Target screen structure (desktop)
1. **Left sidebar**, approximately 260px wide at a 1672px viewport. Midnight navy base, wordmark, short tagline, active item highlighted blue, compact icons and section spacing. Show current real navigation destinations. Items from the screenshot that do not yet have routes/features must be omitted or marked 'Coming soon' and disabled, never dead links.
2. **Header**, about 70–80px height: title 'Health Intelligence Center', contextual subtitle, ward search (actually wired if displayed), date/filter selector (actually wired or plainly noninteractive), notifications (real only), user area (do not invent authenticated identity). Mark DEMO when demo data are used.
3. **Top KPI row**: four equal cards with icons, values, microcharts, labels: high-risk wards, citizen reports, active field teams, predicted risk. Bind to real existing sources where possible. If missing, show a meaningful unavailable state rather than made-up values. Trend deltas only when two comparable time periods exist.
4. **Main content grid**: large risk map on left (~60–64% width), right column (~36–40%) with risk trend and AI insights.
5. **Map**: readable Dhaka basemap + risk overlay, subtle cyan paths/borders, labels, legend, zoom controls, ward selection and hover/details, loading state, data provenance and timestamp. Use React Leaflet already present. A honeycomb overlay may be added as a genuine, correctly geolocated geospatial layer if suitable data/algorithm exist. Otherwise retain truthful, accurate geographic map overlays and approximate the visual treatment without falsely claiming real polygon or hex boundaries. Do not paint the reference screenshot on top of a map.
6. **Right panels**: seven-day chart built with Recharts only if the application has a genuine forecast series; otherwise label it illustrative demo or hide it. An AI insights feed must distinguish real AI response, static demo scenarios, and unavailable status.
7. **Bottom row**: Ward Priority Queue (use actual SWAPI and/or existing dispatch queue), Citizen Reports (only real recent-report endpoint data or clearly labeled mock feed), Data Quality/Freshness (only real source freshness/health checks or unavailable/demo state).

## Design tokens (baseline; visually tune using screenshot)
- sidebar: `#0C1829`
- app canvas: `#142235`
- elevated cards: `#20354D` (may mix with `#172C45`)
- dark inset map surface: `#081C36`
- border: `rgba(99, 165, 223, 0.22)`
- text primary: `#F2F7FF`
- text muted: `#9FB3C9`
- cyan/accent: `#46C8E5`
- violet/accent: `#9B83F5`
- green/status: `#33D6A6`
- warning/medium: `#F6BA49`
- high/severe: `#F45B79`

Use Inter or another excellent legible sans-serif; approximate type sizes from screenshot. Avoid excess gradients or bright glows except on map hotspots, focused controls and chart data lines. Card radii typically 12–16px, padding 16–22px, narrow but deliberate 12–16px grid gaps, 1px cool-blue borders, text contrast WCAG AA where feasible. Risk meaning must be visible by text/icon, not color alone.

## Behavior and UX
- Active state should follow route; keyboard/focus states; real toggles, search, filter and selections must do something useful.
- 1440/1672 desktop match the reference as closely as practical, tablet stacks into wider map + narrower controls, mobile becomes a compact accessible navigation with one-column cards and map.
- No horizontal overflow, overlapping layers, clipped labels or unreachable actions.
- Loading skeletons, error states, retry, empty states, demo-data marks, last-updated values, and backend-offline indication.
- Keep existing routes and do not break old links.
- Preserve citizen report submission and any file upload, ward detail popups, dispatch actions, RAG chat and their existing request/response contracts.
- No fictional current-government partnerships, counterfeit logos, invented user identities, false 'live' badges or artificially inflated metrics from the image.
- Maintain a separate sample/demo mode if realistic illustrations are needed for design presentations, and label it.

## Current source-to-UI mapping
- `/api/swapi/all`: actual SWAPI ward scores for ward table, priority ordering and summaries.
- `/api/swapi/stats/summary`: server-reported summary counts.
- `/api/heatmap/wards`: coordinate/bounds-based ward risk overlay as currently implemented.
- `/api/dispatch/queue`: dispatch priority/actions if response schema supports it.
- Citizen reporting routes: inspect actual API, do NOT invent list endpoints.
- Existing `LLMChat.jsx`: retain and adapt AI assistant UI; distinguish the generative assistant from static AI Insight cards.
- Forecast charts, team deployment metrics, notification counts and source freshness: only use if backed by actual current code/API, otherwise label as demonstration or unavailable.

## Acceptance criteria — visual and functional
- Screenshot comparison at 1672x941 and 1440x900 for overall proportions, color, typography, cards, navigation and responsive fit.
- Pixel-close recreation of structural layout but not necessarily byte-for-byte identical because static image typography, map geometry and mock values can differ from real live data.
- Map remains interactive and correctly georeferenced.
- All existing functional workflows still work. Backend/API and risk algorithm unchanged unless user separately authorizes functionality changes.
- No unsupported risk forecasts or unsupported claims of live data.
- Accessibility focus indicators, readable labels and keyboard access.
- No broken pages when backend is offline; show honest demo/error states.

## Suggested component organization (adapt to existing conventions)
```
frontend/src/
  styles/theme.css                 # or index.css/Tailwind tokens
  components/layout/AppShell.jsx
  components/layout/Sidebar.jsx
  components/layout/DashboardHeader.jsx
  components/ui/{MetricCard,Panel,StatusBadge,EmptyState,LoadingSkeleton}.jsx
  components/dashboard/{RiskMapPanel,RiskTrendChart,AIInsightsPanel,WardPriorityQueue,ReportsPreview,DataQualityPanel}.jsx
  pages/HealthIntelligence.jsx
```
Do not duplicate existing components if it would be simpler and safer to reuse and restyle them.

## Iterative stages
A. Global theme tokens, sidebar, responsive page shell, typographic system.
B. Four KPI cards and dashboard grid matching the reference.
C. Interactive map and honest risk legend/data source.
D. Trends, AI insights, queue, reports, status (real data when available, explicit demo otherwise).
E. Re-style citizen and authority workflows under the same shell.
F. Final end-to-end tests, cross-size screenshot comparisons, accessibility and layout polishing. Keep integrated verification after the design stages if requested by the user.
