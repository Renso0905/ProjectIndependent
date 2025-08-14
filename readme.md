# Project Independent — Phase A (Next.js + FastAPI)

Monorepo with:
- **Frontend:** Next.js (App Router, TypeScript, Tailwind) in `apps/web`
- **Backend:** FastAPI (Python) in `apps/api`

This README mirrors the current scaffold from your files and notes.

---

## Repository Layout

```text
ProjectIndependent/
├─ apps/
│  ├─ api/                               # FastAPI backend
│  │  ├─ app/
│  │  │  ├─ __init__.py
│  │  │  ├─ main.py                      # app entrypoint (FastAPI)
│  │  │  ├─ db.py                        # DB engine/session helpers
│  │  │  ├─ models.py                    # ORM models (TBD)
│  │  │  ├─ auth.py                      # auth helpers/logic (TBD)
│  │  │  └─ settings.py                  # config/env loading
│  │  ├─ pi.db                           # dev SQLite DB (ignored by git)
│  │  ├─ requirements.txt                # Python deps
│  │  ├─ env/                            # venv (ignored)
│  │  └─ __pycache__/                    # ignored
│  │
│  └─ web/                               # Next.js frontend (App Router)
│     ├─ app/
│     │  ├─ layout.tsx
│     │  ├─ page.tsx                     # landing
│     │  ├─ globals.css
│     │  ├─ login/
│     │  │  ├─ bcba/
│     │  │  │  └─ page.tsx               # BCBA login
│     │  │  └─ rbt/
│     │  │     └─ page.tsx               # RBT login
│     │  ├─ dashboard/
│     │  │  ├─ bcba/
│     │  │  │  └─ page.tsx               # BCBA dashboard
│     │  │  └─ rbt/
│     │  │     └─ page.tsx               # RBT dashboard
│     │  └─ clients/
│     │     ├─ page.tsx                  # clients index
│     │     ├─ new/
│     │     │  └─ page.tsx               # create client
│     │     └─ [id]/
│     │        └─ page.tsx               # client detail
│     │
│     ├─ .env.local                      # frontend env (ignored)
│     ├─ middleware.ts
│     ├─ next.config.mjs
│     ├─ next-env.d.ts
│     ├─ package.json
│     ├─ package-lock.json
│     ├─ postcss.config.js
│     ├─ tailwind.config.js
│     ├─ tsconfig.json
│     ├─ node_modules/                   # ignored
│     └─ .next/                          # ignored
│
├─ .gitignore
├─ readme.md
├─ run_api.bat                           # start backend
├─ run_web.bat                           # start frontend
├─ run_all.bat                           # start both
└─ package-lock.json                     # (root)
