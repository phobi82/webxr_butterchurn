@echo off
setlocal
cd /d "%~dp0"

set "WEBXR_HTTPS_PORT=8443"
set "WEBXR_HTTPS_CERT_PASSWORD=webxr-local"
set "WEBXR_HTTPS_DIR=%~dp0local-dev-https"
set "WEBXR_CERT_FILE=%WEBXR_HTTPS_DIR%\local-dev-cert.pfx"

if not exist "%WEBXR_CERT_FILE%" (
	echo Generating local HTTPS certificate...
	if not exist "%WEBXR_HTTPS_DIR%" mkdir "%WEBXR_HTTPS_DIR%"
	powershell.exe -ExecutionPolicy Bypass -File "%WEBXR_HTTPS_DIR%\generate-local-dev-cert.ps1" -OutputPfxPath "%WEBXR_CERT_FILE%" -Password "%WEBXR_HTTPS_CERT_PASSWORD%"
	if errorlevel 1 (
		echo Certificate generation failed.
		pause
		exit /b 1
	)
)

echo.
echo Starting local HTTPS server...
echo.
node "%WEBXR_HTTPS_DIR%\local-https-server.js"
