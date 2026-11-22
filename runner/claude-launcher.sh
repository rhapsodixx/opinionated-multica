#!/usr/bin/env bash
set -euo pipefail
real=${CLAUDE_REAL:-/usr/local/bin/claude}
case ${1:-} in
  --version|-v|--help|-h) exec "$real" "$@" ;;
esac
policy=/etc/opinionated-multica/multica-claude.local.md
settings=/etc/opinionated-multica/claude-settings.json
[[ -s "$policy" && -s "$settings" ]] || { echo 'Runner policy is missing.' >&2; exit 2; }
exec "$real" --setting-sources user --settings "$settings" \
  --append-system-prompt-file "$policy" --append-subagent-system-prompt-file "$policy" "$@"
