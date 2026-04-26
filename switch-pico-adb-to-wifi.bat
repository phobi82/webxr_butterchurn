@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where adb >nul 2>nul
if errorlevel 1 (
	echo adb was not found in PATH.
	echo Install Android platform-tools or add adb to PATH.
	pause
	exit /b 1
)

echo.
echo Detecting Pico adb targets...
set "PICO_USB_SERIAL="
set "PICO_USB_LABEL="
set "PICO_USB_LIST="
set "PICO_WIFI_LIST="
set /a PICO_USB_COUNT=0
set /a PICO_WIFI_COUNT=0

for /f "skip=1 tokens=1,2" %%A in ('adb devices') do (
	if "%%B"=="device" (
		set "ADB_SERIAL=%%A"
		if /I not "!ADB_SERIAL:~0,9!"=="emulator-" (
			set "ADB_MANUFACTURER="
			set "ADB_BRAND="
			set "ADB_MODEL="
			for /f "delims=" %%C in ('adb -s !ADB_SERIAL! shell getprop ro.product.manufacturer 2^>nul') do if not defined ADB_MANUFACTURER set "ADB_MANUFACTURER=%%C"
			for /f "delims=" %%C in ('adb -s !ADB_SERIAL! shell getprop ro.product.brand 2^>nul') do if not defined ADB_BRAND set "ADB_BRAND=%%C"
			for /f "delims=" %%C in ('adb -s !ADB_SERIAL! shell getprop ro.product.model 2^>nul') do if not defined ADB_MODEL set "ADB_MODEL=%%C"
			echo(!ADB_MANUFACTURER! !ADB_BRAND! !ADB_MODEL!| findstr /I "pico" >nul
			if not errorlevel 1 (
				if "!ADB_SERIAL::=!"=="!ADB_SERIAL!" (
					set /a PICO_USB_COUNT+=1
					set "PICO_USB_SERIAL=!ADB_SERIAL!"
					set "PICO_USB_LABEL=!ADB_MANUFACTURER! !ADB_MODEL!"
					if defined PICO_USB_LIST (
						set "PICO_USB_LIST=!PICO_USB_LIST!, !ADB_SERIAL!"
					) else (
						set "PICO_USB_LIST=!ADB_SERIAL!"
					)
				) else (
					set /a PICO_WIFI_COUNT+=1
					if defined PICO_WIFI_LIST (
						set "PICO_WIFI_LIST=!PICO_WIFI_LIST!, !ADB_SERIAL!"
					) else (
						set "PICO_WIFI_LIST=!ADB_SERIAL!"
					)
				)
			)
		)
	)
)

if !PICO_USB_COUNT! equ 0 (
	if !PICO_WIFI_COUNT! equ 1 (
		echo Pico is already connected over Wi-Fi as !PICO_WIFI_LIST!.
		echo.
		echo Current adb devices:
		adb devices
		echo.
		echo Connect the Pico over USB first if you want to run the USB-to-Wi-Fi switch sequence again.
		pause
		exit /b 0
	)
	if !PICO_WIFI_COUNT! gtr 1 (
		echo Multiple Pico devices are already connected over Wi-Fi: !PICO_WIFI_LIST!
		echo Connect the target Pico over USB if you want this script to select one for switching.
		pause
		exit /b 0
	)
	echo No Pico device was detected in adb.
	echo Connect one Pico over USB, allow USB debugging, and try again.
	pause
	exit /b 1
)

if !PICO_USB_COUNT! gtr 1 (
	echo More than one USB-connected Pico was detected: !PICO_USB_LIST!
	echo Disconnect the extra Pico devices and run the script again.
	pause
	exit /b 1
)

echo Using Pico over USB: !PICO_USB_SERIAL! !PICO_USB_LABEL!
echo.
set "PICO_IP="
set "PICO_IP_CIDR="
set "PICO_WIFI_SERIAL="
set /a PICO_IP_READ_TRY=0

:readPicoIp
set /a PICO_IP_READ_TRY+=1

echo Reading Pico Wi-Fi address from wlan0...
set "PICO_IP_CIDR="
for /f "tokens=2" %%A in ('adb -s !PICO_USB_SERIAL! shell ip addr show wlan0 ^| findstr /R /C:"inet " 2^>nul') do (
	set "PICO_IP_CIDR=%%A"
)

if defined PICO_IP_CIDR (
	for /f "tokens=1 delims=/" %%A in ("!PICO_IP_CIDR!") do set "PICO_IP=%%A"
)

if not defined PICO_IP (
	for /f %%A in ('adb -s !PICO_USB_SERIAL! shell getprop dhcp.wlan0.ipaddress 2^>nul') do (
		if not "%%A"=="" (
			set "PICO_IP=%%A"
		)
	)
)

if not defined PICO_IP (
	if !PICO_IP_READ_TRY! geq 10 (
		echo Could not detect a Pico Wi-Fi address from wlan0.
		echo Run "adb -s !PICO_USB_SERIAL! shell ip addr show wlan0" manually and connect with:
		echo adb connect ^<pico-ip^>:5555
		pause
		exit /b 1
	)
	timeout /t 2 /nobreak >nul
	goto readPicoIp
)

echo Detected Pico Wi-Fi address: !PICO_IP!
set "PICO_WIFI_SERIAL=!PICO_IP!:5555"
echo.
echo Switching the USB-connected Pico to adb tcpip mode on port 5555...
adb -s !PICO_USB_SERIAL! tcpip 5555
if errorlevel 1 (
	echo Failed to enable adb tcpip mode.
	echo Make sure the detected Pico stays connected over USB and USB debugging is allowed.
	pause
	exit /b 1
)

echo.
echo Connecting adb over Wi-Fi...
adb disconnect !PICO_WIFI_SERIAL! >nul 2>nul
set /a PICO_CONNECT_TRY=0

:connectPicoWifi
set /a PICO_CONNECT_TRY+=1
adb connect !PICO_WIFI_SERIAL! >nul 2>nul
adb -s !PICO_WIFI_SERIAL! get-state 2>nul | findstr /R /C:"^device$" >nul
if errorlevel 1 (
	if !PICO_CONNECT_TRY! geq 10 (
		echo Failed to connect to !PICO_WIFI_SERIAL!.
		echo Keep USB connected, confirm the Pico is on the same Wi-Fi, and try again.
		pause
		exit /b 1
	)
	timeout /t 2 /nobreak >nul
	goto connectPicoWifi
)

echo.
echo Current adb devices:
adb devices
echo.
echo If the Pico shows up as !PICO_WIFI_SERIAL!, you can unplug USB now.
pause
