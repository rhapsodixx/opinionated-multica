# Potato implementation work

Status: tracked design and preparation, 22 November 2026.

| Order | Deliverable | Acceptance |
| --- | --- | --- |
| 0 | [Ronda repository readiness](repository-readiness.md) and minimum runner | Baseline failures/commands/journeys; feature map; tested existing drivers; ranked corrections become API/check improvements with good/bad examples |
| 1 | Certified pinned polyglot runner image and private extension bundle | Doctor matches every pin; two clean runners receive identical skills/plugins/MCP; personal local rules do not load |
| 2 | Local full/fast verification and coverage adapter | Correct mode/impact selection; real per-layer coverage; validated full SHA, clean state, profile/release, results and artifact contents |
| 3 | Three workflow skill adapters and human checkpoints | Feature intent/ADR/plan and TDD; systematic bug investigation; private read-only issue triage parity |
| 4 | Provider-neutral Git publication with evidence | Agent commits/pushes task branch and opens/updates PR/MR with template, actual output and screenshots; no protection/hosted-CI dependency |
| 5 | Parallel and cross-repo acceptance | Separate worktrees/services; agreed contracts; aggregate SHA/test evidence; serialized migration/integration |
| 6 | Ronda pilot and measured rollout | One feature, one bug and one synthetic alert replay; reverts/fix-forward/escapes/rework/performance against baseline; bounded review; human merge |

Complete Phase 0 before broad runner certification or concurrency expansion.
After the shared contracts, image packaging, test adapter and workflow adapters can be implemented by separate agents.
Define their file ownership and interfaces first. Integrate in order and run the full local profile.
Keep coordinator deployment and production changes outside the initial runner preparation work.
Keep repository cleanup focused on affected features and boundaries. Use statecharts selectively, then test the relevant transitions.

The installer checks Docker/Compose, builds the pinned shared image and prepares a bundle. It never logs in or starts the daemon.
Command-blocking hooks and an independent evidence verifier require separate proposals. Neither is an approved implementation prerequisite.

Browser acceptance spans deliverables 1–4: deliver the shared browser-verification skill and pinned Playwright MCP definition,
reuse each repository's locked test harness, and run applicable UI journeys as the final local verification layer.
Prove matching browser revisions, isolated sessions, scenario coverage, screenshots and failure artifacts on both image architectures.
MCP exploration alone cannot satisfy the automated test gate. See the [test policy](testing.md#playwright-as-the-final-browser-check).

## Tracking issues

The [doctor command](doctor.md) now covers machine, bundle and repository preflight, with explicit image/browser probes.
It leaves native extension/authentication acceptance unchecked and does not replace the product verification adapter.

- [Phase 0: prove Ronda repository readiness before scaling Potato](https://github.com/rhapsodixx/opinionated-multica/issues/7)

- [Build and certify the pinned polyglot runner image](https://github.com/rhapsodixx/opinionated-multica/issues/1)
- [Implement local full and fast verification with per-layer coverage](https://github.com/rhapsodixx/opinionated-multica/issues/2)
- [Implement feature, bug and issue workflows with human checkpoints](https://github.com/rhapsodixx/opinionated-multica/issues/3)
- [Implement Git-provider publication and PR evidence attachment](https://github.com/rhapsodixx/opinionated-multica/issues/4)
- [Verify parallel agents and changes across repositories](https://github.com/rhapsodixx/opinionated-multica/issues/5)
- [Run the Ronda pilot and measure rollout readiness](https://github.com/rhapsodixx/opinionated-multica/issues/6)

These issues track later implementation. Review the plan before assigning implementation or deploying runners.
