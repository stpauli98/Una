#!/usr/bin/env bash
# Run Playwright PWA + SEO suites against a production build.
# Builds, starts `next start`, waits for the server, runs the suites, then cleans up.

set -euo pipefail

# 1. Build (uses webpack to enable Serwist — see package.json build script)
echo "→ Building production bundle..."
npm run build

# 2. Start prod server in background
echo "→ Starting production server..."
npx next start > /tmp/up-beauty-pwa-prod.log 2>&1 &
SERVER_PID=$!

# Make sure we always clean up
cleanup() {
  if kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# 3. Wait for server to be ready
echo "→ Waiting for server to be ready..."
for i in {1..20}; do
  if curl -sf -o /dev/null http://localhost:3000/sw.js; then
    echo "→ Server ready after ${i}s"
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "✗ Server crashed during startup. Last log lines:"
    tail -20 /tmp/up-beauty-pwa-prod.log
    exit 1
  fi
  sleep 1
done

# Verify reachability one more time
if ! curl -sf -o /dev/null http://localhost:3000/sw.js; then
  echo "✗ Server not responding after 20s. Last log lines:"
  tail -20 /tmp/up-beauty-pwa-prod.log
  exit 1
fi

# 4. Run the suites
echo "→ Running Playwright PWA + SEO suites against prod build..."
PLAYWRIGHT_SKIP_WEB_SERVER=1 E2E_SUPABASE_SERVICE_ROLE_KEY= npx playwright test pwa.spec.ts seo.spec.ts "$@"
