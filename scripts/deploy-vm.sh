#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <ssh-target>"
  echo "Example: $0 azureuser@nyxen.centralindia.cloudapp.azure.com"
  exit 2
fi

SSH_TARGET="$1"
REMOTE_DIR="${REMOTE_DIR:-~/campus-project}"
ARCHIVE="$(mktemp -t campus-project.XXXXXX.tar.gz)"

cleanup() {
  rm -f "$ARCHIVE"
}
trap cleanup EXIT

tar \
  --exclude='./node_modules' \
  --exclude='./client/node_modules' \
  --exclude='./server/node_modules' \
  --exclude='./client/dist' \
  --exclude='./.data' \
  --exclude='./server/.env' \
  --exclude='./.git' \
  --exclude='./instruction.md' \
  -czf "$ARCHIVE" .

ssh "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
scp "$ARCHIVE" "$SSH_TARGET:$REMOTE_DIR/app.tar.gz"
ssh "$SSH_TARGET" "cd $REMOTE_DIR && tar -xzf app.tar.gz && rm app.tar.gz && test -f .env && docker compose --env-file .env -f docker-compose.yml up -d --build"
