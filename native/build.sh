#!/bin/sh
# Builds the native helper. The Info.plist is embedded so macOS lets it use the mic and speech recognition.
set -e
cd "$(dirname "$0")"
mkdir -p ../bin
swiftc -O -swift-version 5 Sources/main.swift -o ../bin/jevhelper \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker Info.plist
codesign --force --sign - --identifier dev.jev.helper ../bin/jevhelper 2>/dev/null || true
echo "built bin/jevhelper"
