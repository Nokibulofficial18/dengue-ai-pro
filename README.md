# DengueAI Pro

## Local Development (No Docker needed)

### Backend

cd backend
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --reload --port 8000

### Frontend

cd frontend
npm install
cp .env.example .env
npm run dev

Open http://localhost:5173

## Deploy to Railway (Backend)

1. Push to GitHub
2. New project on railway.app → Deploy from GitHub
3. Select backend/ folder
4. Add env variables: DEMO_MODE=true, ANTHROPIC_API_KEY=your_key
5. Railway auto-detects Python and uses Procfile

## Deploy to Vercel (Frontend)

1. Push to GitHub
2. New project on vercel.com → Import from GitHub
3. Set root directory: frontend
4. Add env variable: VITE_API_URL=https://your-railway-url.railway.app
5. Deploy

## Features

- Live dengue risk heatmap for 10 Dhaka wards
- SWAPI risk scoring with explainable contributing factors
- LLM-powered dispatch orders (Claude AI + RAG)
- Citizen photo reporting with AI verification
- Authority command dashboard
- Works in demo mode without any API keys

## Team

GSTU NEUROBLITZZZ | Gopalganj Science and Technology University
The Infinity AI BuildFest 2026 | Track 3 — HealthTech
