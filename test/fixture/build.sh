#!/bin/sh
# Builds bin/JevFixture.app, the test app used by integration tests and evals.
set -e
cd "$(dirname "$0")"
APP=../../bin/JevFixture.app
mkdir -p "$APP/Contents/MacOS"
swiftc -O -swift-version 5 main.swift -o "$APP/Contents/MacOS/JevFixture"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>dev.jev.fixture</string>
  <key>CFBundleName</key><string>JevFixture</string>
  <key>CFBundleExecutable</key><string>JevFixture</string>
  <key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
PLIST
codesign --force --sign - "$APP" 2>/dev/null || true
echo "built bin/JevFixture.app"
