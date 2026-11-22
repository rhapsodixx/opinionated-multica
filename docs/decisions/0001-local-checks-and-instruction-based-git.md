# ADR-0001: Use shared runners, local checks and instruction-based Git writes

## Status

Selected direction, 22 November 2026. Runtime implementation and certification are pending.

## Context

Agents need one repeatable Multica/Claude Code setup across languages, repositories and Git hosts.
The owner accepts agent instructions as the merge/default-branch boundary. Git writes are allowed.
Local results and screenshots must appear in PR/MR descriptions before human merge review.

## Decision

Use pinned runner containers on dedicated VMs. Share approved tool/skill/plugin/MCP catalogs and runner-owned policy.
Keep project guidance engine-agnostic. Use local full/fast profiles with explicit per-layer coverage and omitted cases.
Let agents commit, push task branches and publish PRs/MRs after checks pass. Require human plan review and merge through instructions.

Do not require hosted workflows, branch protection, ruleset APIs, a paid Git plan, a signing service or a separate privileged publisher.
The platform is provider-neutral; Git-host adapters handle publication, not verification.

## Alternatives

- Hosted-only checks: add a service/billing dependency and do not meet the local-evidence goal alone.
- Mandatory server-side merge protection/publisher: stronger technical controls, but the owner does not require them for this platform.
- Mutable shared workspaces: easier first setup, but cause state conflicts and runner drift.

## Consequences

The merge restriction is not a technical permission guarantee. Do not describe it as one.
Tests must bind evidence to the actual candidate and distinguish full from fast coverage.
Future operators may add protection/hosted CI, but basic operation must not depend on it.
Private plugins, credentials and production evidence remain outside this public repository.
