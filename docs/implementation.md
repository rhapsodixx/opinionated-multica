# Implementation work

Status: tracked design and preparation, 22 November 2026.

| Order | Deliverable | Acceptance |
| --- | --- | --- |
| 1 | Certified pinned polyglot runner image and private extension bundle | Doctor matches every pin; two clean runners receive identical skills/plugins/MCP; personal local rules do not load |
| 2 | Local full/fast verification and coverage adapter | Correct mode/impact selection; real per-layer coverage; no missing/empty/failed required suite reports success |
| 3 | Three workflow skill adapters and human checkpoints | Feature intent/ADR/plan and TDD; systematic bug investigation; private read-only issue triage parity |
| 4 | Provider-neutral Git publication with evidence | Agent commits/pushes task branch and opens/updates PR/MR with template, actual output and screenshots; no protection/hosted-CI dependency |
| 5 | Parallel and cross-repo acceptance | Separate worktrees/services; agreed contracts; aggregate SHA/test evidence; serialized migration/integration |
| 6 | Ronda pilot and measured rollout | One feature, one bug and one synthetic alert replay; local gate and applicable seeded UI tests; measured resources; human merge |

After the shared contracts, image packaging, test adapter and workflow adapters can be implemented by separate agents.
Define their file ownership and interfaces first. Integrate in order and run the full local profile.
Keep coordinator deployment and production changes outside the initial runner preparation work.

## Tracking issues

- [Build and certify the pinned polyglot runner image](https://github.com/rhapsodixx/opinionated-multica/issues/1)
- [Implement local full and fast verification with per-layer coverage](https://github.com/rhapsodixx/opinionated-multica/issues/2)
- [Implement feature, bug and issue workflows with human checkpoints](https://github.com/rhapsodixx/opinionated-multica/issues/3)
- [Implement Git-provider publication and PR evidence attachment](https://github.com/rhapsodixx/opinionated-multica/issues/4)
- [Verify parallel agents and changes across repositories](https://github.com/rhapsodixx/opinionated-multica/issues/5)
- [Run the Ronda pilot and measure rollout readiness](https://github.com/rhapsodixx/opinionated-multica/issues/6)

These issues track later implementation. Review the plan before assigning implementation or deploying runners.
