#!/bin/sh
# node_modules lives in a Docker volume, so it outlives the image. Reinstall when
# package-lock.json no longer matches the one it was installed from.
set -e
if ! sha256sum -c --status node_modules/.lock-hash 2>/dev/null; then
  echo "package-lock.json changed: reinstalling dependencies..."
  npm ci
  sha256sum package-lock.json > node_modules/.lock-hash
fi
exec "$@"
