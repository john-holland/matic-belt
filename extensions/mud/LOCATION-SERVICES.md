# 📍 Enabling Location Services for WiFi Scanning

On macOS, WiFi scanning requires Location Services permission. Here are the steps:

## Method 1: System Preferences (Recommended)

1. **Open System Preferences** (or System Settings on macOS Ventura+)
   - Click the Apple menu → System Preferences
   - Or search for "System Preferences" in Spotlight

2. **Navigate to Privacy Settings**
   - Click **Security & Privacy** (or **Privacy & Security** on newer macOS)
   - Click the **Privacy** tab
   - Select **Location Services** from the left sidebar

3. **Enable Location Services**
   - Make sure the checkbox at the top is checked: "Enable Location Services"
   - If it's not enabled, click the lock icon (bottom left) to unlock, enter your password, then check the box

4. **Grant Permission to Your Terminal**
   - Scroll through the list of applications
   - Find your terminal application:
     - **Terminal** (if using macOS Terminal)
     - **iTerm** (if using iTerm2)
     - **Hyper** (if using Hyper terminal)
     - Or any other terminal app you use
   - Check the box next to your terminal app to allow location access

5. **Restart the MUD Server**
   ```bash
   cd extensions/mud
   npm start
   ```

## Method 2: Using the Helper Script

Run the helper script:
```bash
cd extensions/mud
./enable-location-services.sh
```

This will:
- Check Location Services status
- Provide step-by-step instructions
- Optionally open System Preferences for you

## Method 3: Run with Sudo (Alternative)

If you can't enable Location Services, you can run with elevated permissions:
```bash
cd extensions/mud
sudo npm start
```

**Note:** Running with sudo gives the process root privileges, which may bypass some permission checks.

## Verification

After enabling, check the server logs:
```bash
tail -f /tmp/mud-server.log
```

You should see:
- `✅ WiFi initialized successfully`
- `🔍 Detected WiFi interface: en0`
- `✅ WiFi scan found X networks` (where X > 0)

## Troubleshooting

### Still seeing 0 networks?

1. **Make sure WiFi is enabled** on your Mac
2. **Check you're connected** to a WiFi network (even if just for testing)
3. **Restart your terminal** after granting permissions
4. **Try running with sudo** as a test:
   ```bash
   sudo npm start
   ```

### Permission denied errors?

- Make sure you unlocked System Preferences (click the lock icon)
- Make sure you granted permission to the correct terminal app
- Try restarting your Mac if permissions don't seem to take effect

## Why Location Services?

macOS requires Location Services for WiFi scanning as a privacy feature. WiFi networks can be used to determine approximate location, so Apple requires apps to request location permission before accessing WiFi information.

## Alternative: Browser-Based Scanning

If system-level WiFi scanning doesn't work, you could also implement browser-based WiFi scanning using the Web Bluetooth API or similar, but this has limitations and may not work for all use cases.

