# DengueAI Pro

AI-native dengue prevention intelligence system for Bangladesh. DengueAI Pro combines SWAPI risk scoring, RAG-grounded guidance, and citizen reporting to help authorities act before outbreaks escalate.

## Highlights

- Live dengue risk heatmap for 10 Dhaka wards
- SWAPI risk scoring with explainable contributing factors
- LLM-powered dispatch orders (Claude AI + RAG)
- Citizen photo reporting with AI verification and points
- Authority command dashboard
- Works in demo mode without any API keys

## Tech Stack

- Frontend: Vite + React 18 + Tailwind CSS + Leaflet
- Backend: FastAPI + SQLite (local) + async SQLAlchemy
- RAG: in-memory cosine similarity (no external vector DB)

## Local Development (No Docker)

### Backend

1) From the project root, go to the backend folder
2) Install dependencies
3) Create a local env file
4) Run the API

Commands

cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

Backend runs on http://localhost:8000

### Frontend

1) From the project root, go to the frontend folder
2) Install dependencies
3) Create a local env file
4) Run the app

Commands

cd frontend
npm install
cp .env.example .env
npm run dev

Frontend runs on http://localhost:5173

## Demo Reset Endpoint

Use this before a presentation to reset demo data:

POST http://localhost:8000/api/demo/reset

## Deployment

### Backend to Railway or Render

1) Push to GitHub
2) Create a new service and point it to the backend folder
3) Add env vars:
	- DEMO_MODE=true
	- ANTHROPIC_API_KEY=your_key
	- OPENAI_API_KEY=optional
4) Deploy (Procfile is included)

### Frontend to Vercel or Netlify

1) Push to GitHub
2) Create a new project and set root directory to frontend
3) Add env var:
	- VITE_API_URL=https://your-backend-url
4) Deploy

## Environment Variables

Backend (backend/.env.example)
- DEMO_MODE=true
- DATABASE_URL=sqlite+aiosqlite:///./dengueai.db
- ANTHROPIC_API_KEY=demo
- OPENWEATHERMAP_API_KEY=demo
- OPENAI_API_KEY=demo

Frontend (frontend/.env.example)
- VITE_API_URL=http://localhost:8000

## Project Structure

- backend: FastAPI service with SQLite, RAG retriever, and demo data
- frontend: Vite + React app with heatmap, dashboards, and reporting

## Team

GSTU NEUROBLITZZZ | Gopalganj Science and Technology University
The Infinity AI BuildFest 2026 | Track 3 — HealthTech
