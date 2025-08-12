@echo off
cd /d "%~dp0apps\web"
if not exist node_modules (
  echo Installing web dependencies...
  npm install
)
echo Starting Next.js on http://localhost:3000
npm run dev
pause
