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
echo Detecting Quest adb targets...
set "QUEST_USB_SERIAL="
set "QUEST_USB_LABEL="
set "QUEST_USB_LIST="
set "QUEST_WIFI_LIST="
set /a QUEST_USB_COUNT=0
set /a QUEST_WIFI_COUNT=0

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
			echo(!ADB_MANUFACTURER! !ADB_BRAND! !ADB_MODEL!| findstr /I "meta oculus quest" >nul
			if not errorlevel 1 (
				if "!ADB_SERIAL::=!"=="!ADB_SERIAL!" (
					set /a QUEST_USB_COUNT+=1
					set "QUEST_USB_SERIAL=!ADB_SERIAL!"
					set "QUEST_USB_LABEL=!ADB_MANUFACTURER! !ADB_MODEL!"
					if defined QUEST_USB_LIST (
						set "QUEST_USB_LIST=!QUEST_USB_LIST!, !ADB_SERIAL!"
					) else (
						set "QUEST_USB_LIST=!ADB_SERIAL!"
					)
				) else (
					set /a QUEST_WIFI_COUNT+=1
					if defined QUEST_WIFI_LIST (
						set "QUEST_WIFI_LIST=!QUEST_WIFI_LIST!, !ADB_SERIAL!"
					) else (
						set "QUEST_WIFI_LIST=!ADB_SERIAL!"
					)
				)
			)
		)
	)
)

if !QUEST_USB_COUNT! equ 0 (
	if !QUEST_WIFI_COUNT! equ 1 (
		echo Quest is already connected over Wi-Fi as !QUEST_WIFI_LIST!.
		echo.
		echo Current adb devices:
		adb devices
		echo.
		echo Connect the Quest over USB first if you want to run the USB-to-Wi-Fi switch sequence again.
		pause
		exit /b 0
	)
	if !QUEST_WIFI_COUNT! gtr 1 (
		echo Multiple Quest devices are already connected over Wi-Fi: !QUEST_WIFI_LIST!
		echo Connect the target Quest over USB if you want this script to select one for switching.
		pause
		exit /b 0
	)
	echo No Quest device was detected in adb.
	echo Connect one Quest over USB, allow USB debugging, and try again.
	pause
	exit /b 1
)

if !QUEST_USB_COUNT! gtr 1 (
	echo More than one USB-connected Quest was detected: !QUEST_USB_LIST!
	echo Disconnect the extra Quest devices and run the script again.
	pause
	exit /b 1
)

echo Using Quest over USB: !QUEST_USB_SERIAL! !QUEST_USB_LABEL!
echo.
echo Switching the USB-connected Quest to adb tcpip mode on port 5555...
adb -s !QUEST_USB_SERIAL! tcpip 5555
if errorlevel 1 (
	echo Failed to enable adb tcpip mode.
	echo Make sure the detected Quest stays connected over USB and USB debugging is allowed.
	pause
	exit /b 1
)

echo.
echo Waiting for adb to reconnect after tcpip restart...
set "QUEST_IP="
set "QUEST_IP_CIDR="
set "QUEST_WIFI_SERIAL="
set /a QUEST_IP_READ_TRY=0

:readQuestIp
set /a QUEST_IP_READ_TRY+=1

adb -s !QUEST_USB_SERIAL! get-state >nul 2>nul
if errorlevel 1 (
	if !QUEST_IP_READ_TRY! geq 10 (
		echo adb did not reconnect after switching to tcpip mode.
		echo Keep the detected Quest connected over USB, confirm USB debugging on the headset, and try again.
		pause
		exit /b 1
	)
	timeout /t 2 /nobreak >nul
	goto readQuestIp
)

echo Reading Quest Wi-Fi address from wlan0...
set "QUEST_IP_CIDR="
for /f "tokens=2" %%A in ('adb -s !QUEST_USB_SERIAL! shell ip addr show wlan0 ^| findstr /R /C:"inet " 2^>nul') do (
	set "QUEST_IP_CIDR=%%A"
)

if defined QUEST_IP_CIDR (
	for /f "tokens=1 delims=/" %%A in ("!QUEST_IP_CIDR!") do set "QUEST_IP=%%A"
)

if not defined QUEST_IP (
	for /f %%A in ('adb -s !QUEST_USB_SERIAL! shell getprop dhcp.wlan0.ipaddress 2^>nul') do (
		if not "%%A"=="" (
			set "QUEST_IP=%%A"
		)
	)
)

if not defined QUEST_IP (
	if !QUEST_IP_READ_TRY! geq 10 (
		echo Could not detect a Quest Wi-Fi address from wlan0.
		echo Run "adb -s !QUEST_USB_SERIAL! shell ip addr show wlan0" manually and connect with:
		echo adb connect ^<quest-ip^>:5555
		pause
		exit /b 1
	)
	timeout /t 2 /nobreak >nul
	goto readQuestIp
)

echo Detected Quest Wi-Fi address: !QUEST_IP!
set "QUEST_WIFI_SERIAL=!QUEST_IP!:5555"
echo.
adb devices | findstr /B /C:"!QUEST_WIFI_SERIAL!" >nul
if not errorlevel 1 (
	echo Quest is already connected over Wi-Fi as !QUEST_WIFI_SERIAL!.
) else (
	echo Connecting adb over Wi-Fi...
	adb connect !QUEST_WIFI_SERIAL!
	if errorlevel 1 (
		echo Failed to connect to !QUEST_WIFI_SERIAL!.
		echo Keep USB connected, confirm the Quest is on the same Wi-Fi, and try again.
		pause
		exit /b 1
	)
)

echo.
echo Current adb devices:
adb devices
echo.
echo If the Quest shows up as !QUEST_WIFI_SERIAL!, you can unplug USB now.
pause
