@echo off
set "ROOT=%~dp0"

REM Launch API in its own window
start "ProjectIndependent API" cmd /k ""%ROOT%run_api.bat""

REM Launch Web in its own window
start "ProjectIndependent Web" cmd /k ""%ROOT%run_web.bat""
