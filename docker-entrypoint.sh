#!/bin/sh
set -e

# Ensure we are in the app dir
cd /app

# If node_modules is missing or empty ( common when bind-mounting ), install deps quickly
if [ ! -d node_modules ] || [ -z "$(ls -A node_modules 2>/dev/null)" ]; then
  echo "[entrypoint] Installing dependencies (node_modules missing)..."
  if npm ci >/dev/null 2>&1; then
    echo "[entrypoint] npm ci completed"
  else
    echo "[entrypoint] npm ci failed, falling back to npm install"
    npm install
  fi
else
  echo "[entrypoint] Using existing node_modules"
fi

exec "$@"
