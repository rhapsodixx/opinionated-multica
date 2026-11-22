# Ronda repository readiness

Status: planned Phase 0. This checklist does not claim that Ronda or the runner is ready.
Complete it before expanding runner capacity, task concurrency or repository coverage.

## Baseline and acceptance

| Work | Acceptance evidence |
| --- | --- |
| Capture the baseline | Full commit SHA, clean state, locked dependencies, approved commands, actual results and known failures with owners |
| Map the product | Features linked to code boundaries, owners, APIs, data and critical user journeys; gaps listed |
| Confirm existing drivers | Tested CLI/browser drivers, their commands, fixtures and supported journeys; a successful synthetic replay for each reused driver |
| Select corrections | Ranked repeated problems with source references, frequency, impact, rework and a reason for selection |
| Improve affected boundaries | Focused API/data-ownership changes and boundary checks; existing behavior remains covered |
| Prove the improvements | Bad examples fail; good examples pass; regression and boundary checks run through the approved local profile |
| Validate evidence | The validator checks candidate, clean state, profile/release, results, coverage and artifact references against actual output |
| Approve expansion | A human accepts the baseline, remaining gaps, quality results and the next capacity step |

Record pre-existing failures separately from new regressions. A known failure remains a failure until it is fixed.
Name any baseline exception, its owner and its effect on acceptance. Do not silently exclude failures to make a run green.
Publish only sanitized results. Use synthetic data for browser journeys and keep production access outside this work.

Prepare the minimum runner needed to run the baseline and first approved task.
Record its pinned image/tool versions, repository commands and required driver dependencies.
The installer checks Docker/Compose, builds the pinned shared image and prepares the bundle. Login and daemon startup remain explicit operator steps.
Bundle preparation does not certify private extensions, product tests or a deployed runner.

## Correction lifecycle

1. Collect repeated corrections from available reviews, tasks and incidents.
2. Group them by cause and rank their frequency, product impact and rework.
3. Select a bounded set that fits the approved task. There is no fixed count or history window.
4. Write a good example and a bad example for each selected problem.
5. Choose a clearer API first, or add the relevant lint, type, boundary or regression check.
6. Run the bad example to prove the check detects the problem.
7. Run the good example and existing behavior to check for false positives.
8. Assign an owner and connect the check to the local profile and short repository guidance.
9. Measure recurrence and rework after adoption. Revise checks that miss the problem or reject valid behavior.

Prefer changes in the affected feature and its immediate boundaries. Keep larger cleanup proposals separate from the approved task.
Use examples to explain the intended rule. Do not impose blanket bans on comments, `useEffect` or timers.

## Complex product behavior

Use a statechart when event order, retries, cancellation, recovery or concurrency makes behavior difficult to test.
Name states, events, guards, side effects and invariants. Link each relevant transition to a test and user journey.
Test forbidden transitions and failure recovery as well as successful transitions.
Use the repository's existing tools where practical. Statecharts do not require TLA+, Lean or another formal tool.

## Quality and review

Track reverts, fix-forward changes, escaped defects, correction recurrence, human rework and relevant product performance.
For each measure, record its definition, sample, denominator, baseline and observation period.
Compare product performance under the same workload and environment. Report small samples and unknown results directly.

Agree on a review-pass limit in the task plan. Each pass must address findings and run the relevant checks.
At the limit, stop automatic revisions and return unresolved findings to the human. Do not declare success to end the loop.
Humans approve plans and merge changes. Command-blocking hooks and independent evidence verification need separate proposals.
