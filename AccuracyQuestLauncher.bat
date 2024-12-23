@echo off
echo Starting Application...

:: Read the port from config.json
echo Setting port...
for /f "tokens=2 delims=:" %%a in ('type config.json ^| findstr "backend_port"') do set PORT=%%~a
set PORT=%PORT:,=%
set PORT=%PORT: =%

:: Start the backend (Flask server)
echo Starting backend...
start /min cmd /c "py app.py"

:: Wait for a moment to ensure the server has started
echo Waiting for backend to start..
timeout /t 20

:: Open the frontend in the default web browser with the port number
echo Starting frontend...
start http://localhost:%PORT%

:: Close the frontend window
echo Closing window...
exit