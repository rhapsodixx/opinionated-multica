#!/usr/bin/env bash
set -euo pipefail
if (( $# )); then exec "$@"; fi
: "${MULTICA_SERVER_URL:?Set the Multica API origin}"
: "${MULTICA_WORKSPACE:?Set the workspace slug}"
multica --profile runner workspace switch "$MULTICA_WORKSPACE"
exec multica --profile runner daemon start --foreground --no-auto-update
