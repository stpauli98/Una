#!/bin/bash
# scripts/health/install-launchd.sh — instalira launchd agent (09:00 i 18:00)
set -euo pipefail
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST=~/Library/LaunchAgents/com.nextpixel.upbeauty-health.plist
NODE_BIN="$(command -v node)"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.nextpixel.upbeauty-health</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${REPO_DIR}/scripts/health/run.mjs</string>
  </array>
  <key>WorkingDirectory</key><string>${REPO_DIR}</string>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>9</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>18</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key><string>${HOME}/Library/Logs/upbeauty-health.log</string>
  <key>StandardErrorPath</key><string>${HOME}/Library/Logs/upbeauty-health.log</string>
</dict>
</plist>
EOF

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"
echo "Instalirano. Test: launchctl start com.nextpixel.upbeauty-health && tail -f ~/Library/Logs/upbeauty-health.log"
