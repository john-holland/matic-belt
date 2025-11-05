#!/bin/bash

# Script to help enable Location Services for WiFi scanning on macOS

echo "📍 Location Services Setup for MUD WiFi Scanner"
echo "================================================"
echo ""

# Check if Location Services is enabled
locationEnabled=$(defaults read /Library/Preferences/com.apple.locationd.plist LocationServicesEnabled 2>/dev/null || echo "unknown")

if [ "$locationEnabled" = "1" ]; then
    echo "✅ Location Services is enabled system-wide"
else
    echo "⚠️  Location Services status: $locationEnabled"
    echo ""
fi

echo "To enable Location Services for WiFi scanning:"
echo ""
echo "1. Open System Preferences (or System Settings on newer macOS)"
echo "2. Go to Security & Privacy > Privacy (or Privacy & Security)"
echo "3. Select 'Location Services' from the left sidebar"
echo "4. Make sure Location Services is enabled (checkbox at top)"
echo "5. Find your Terminal application in the list:"
echo "   - Terminal.app"
echo "   - iTerm.app (if you use iTerm)"
echo "   - Or the app you use to run npm commands"
echo "6. Check the box next to it to allow location access"
echo ""
echo "After enabling, restart the MUD server:"
echo "  cd extensions/mud"
echo "  npm start"
echo ""
echo "Alternative: Run with sudo (has elevated permissions):"
echo "  cd extensions/mud"
echo "  sudo npm start"
echo ""

# Check current terminal app
currentTerminal=$(ps -p $PPID -o comm= 2>/dev/null || echo "unknown")
echo "Current terminal process: $currentTerminal"
echo ""

# Try to open System Preferences
read -p "Would you like to open System Preferences now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -d "/System/Library/PreferencePanes/Security.prefPane" ]; then
        open "x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices"
        echo "✅ Opened System Preferences to Location Services"
    else
        open "x-apple.systempreferences:com.apple.preference.security"
        echo "⚠️  Please navigate to Privacy > Location Services manually"
    fi
fi

