#!/bin/bash
# scripts/health/uninstall-launchd.sh
set -euo pipefail
PLIST=~/Library/LaunchAgents/com.nextpixel.upbeauty-health.plist
launchctl unload "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
echo "Uklonjeno."
