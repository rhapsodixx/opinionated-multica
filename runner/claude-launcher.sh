#!/usr/bin/env bash
set -euo pipefail
real=${CLAUDE_REAL:-/usr/local/bin/claude}
case ${1:-} in
  --version|-v|--help|-h) exec "$real" "$@" ;;
esac
policy=/etc/potato/multica-claude.local.md
settings=/etc/potato/claude-settings.json
[[ -s "$policy" && -s "$settings" ]] || { echo 'Runner policy is missing.' >&2; exit 2; }
exec "$real" --setting-sources user --settings "$settings" \
  --append-system-prompt-file "$policy" --append-subagent-system-prompt-file "$policy" "$@"
