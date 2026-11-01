@echo off
setlocal
cd /d "%~dp0"

if not exist "venv\Scripts\python.exe" (
    echo Project virtual environment not found at venv\Scripts\python.exe.
    pause
    exit /b 1
)

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$config = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway }; if ($config) { $config[0].IPv4Address[0].IPAddress }"`) do set "LAN_IP=%%I"

if not defined LAN_IP (
    echo Could not find a local network address. Connect this computer to Wi-Fi and try again.
    pause
    exit /b 1
)

echo.
echo Secret Imposter is starting.
echo On this computer: http://127.0.0.1:8000
echo Share with friends on the same Wi-Fi: http://%LAN_IP%:8000
echo Keep this window open while you play.
echo.

".\venv\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000

pause
