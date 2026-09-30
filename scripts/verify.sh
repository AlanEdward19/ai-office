#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./build.sh
./lint.sh
./test.sh
echo "verify: OK"
