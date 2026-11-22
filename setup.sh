#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")" && pwd)
command -v node >/dev/null 2>&1 || { echo 'Potato needs Node 22.8+ on the setup host. Install Node, then retry.' >&2; exit 2; }
exec node "$root/bin/potato.mjs" "$@"
