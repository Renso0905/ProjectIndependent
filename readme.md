# Project Independent — Phase A (Next.js + FastAPI)

## Folder layout
ProjectIndependent/
├─ apps/
│ ├─ api/ # FastAPI
│ │ ├─ main.py
│ │ ├─ requirements.txt
│ │ └─ .env (optional; see .env.example)
│ └─ web/ # Next.js (React)
│ ├─ app/
│ │ ├─ layout.tsx
│ │ └─ page.tsx
│ ├─ package.json
│ ├─ next.config.mjs
│ └─ tsconfig.json
└─ .gitignore


## Prereqs
- Python 3.11+  
- Node.js LTS (comes with npm)

## First-time setup

### Backend (FastAPI)
```bat
cd apps\api
python -m venv env
env\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001

Visit: http://127.0.0.1:8001/api/health
