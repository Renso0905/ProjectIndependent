@echo off 
cd /d "%~dp0apps\api"
if not exist env (
  echo Creating virtual environment...
  python -m venv env
)
call env\Scripts\activate
if exist requirements.txt (
  pip install -r requirements.txt >nul
)
echo Starting FastAPI on http://127.0.0.1:8001

REM --- DEBUG: show exactly which module & version will be used ---
env\Scripts\python -c "import app.main; print('BOOT:', app.main.__file__); print('VER:', getattr(app.main.app,'version',None))"

uvicorn app.main:app --reload --port 8001

pause
