@echo off
rem brine-theme manager - single command entry point on Windows.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0brine.ps1" %*
exit /b %ERRORLEVEL%
