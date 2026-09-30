#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
WATCH=0
while [ $# -gt 0 ]; do
  case "$1" in
    --watch) WATCH=1 ;;
    --filter) echo "filter not wired for tsx --test yet: $2" >&2; exit 2 ;;
    *) echo "arg desconhecido: $1" >&2; exit 2 ;;
  esac
  shift
done
if [ "$WATCH" = 1 ]; then
  echo "watch: re-run scripts/test.sh manually (no watch script configured)" >&2
  exit 2
fi
npm test
