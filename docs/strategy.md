# Strategy

Status: proposed setup, 22 November 2026. Multica, Claude Code, pinned containers on dedicated VMs and the first pilot are selected.
Runtime deployment and product implementation have not started.

## Intent

Let a product engineering team assign feature work, bug investigations and issue triage to agents.
Every code change must have local test evidence before its PR/MR. Humans approve plans and merge changes.

Use the Poteto pyramid to place effort in this order:

| Layer | Investment |
| --- | --- |
| Codebase | Good APIs, clear data ownership, testable business logic and coherent refactoring |
| Static analysis | Types, compilers, lint, secret scans, dependency checks and repeatable test gates |
| Verification | Runtime integration, functional UI, migration, race, fuzz and property/state-machine tests |
| Prose | Intent, ADRs, skills and short repository instructions that point to executable checks |
| Human review | Product judgment, design trade-offs, test adequacy and final acceptance |

Unit tests execute behavior. The supplied pyramid groups tests/CI with static analysis; do not confuse those mechanisms with static proof.
Use targeted formal/model checks when an identified high-risk invariant needs them. Do not require TLA+ or Lean for every change.

## Common runner release

All runners use one approved image digest and one policy release. The release includes:

- Claude Code and Multica CLI.
- Node/Bun and the approved package managers, Go and Python toolchains.
- Language tools, including gopls, and verification tools such as Gitleaks, golangci-lint and govulncheck.
- Shared approved skills/plugins, native hooks, browser dependencies and MCP definitions.
- Shared Git pre-commit and commit-message checks, chained with each repository's existing hooks.

Repositories retain their own locked dependencies, lint rules, test commands and compatible runtime selections.
A shared catalog does not mean one global Jest/ESLint/Python environment or one mutable worktree.
Private skill/plugin packages are operator-supplied; this public repository contains policy, not copies of proprietary packages.
Pin revisions, test upgrades on a canary, then replace runners. Do not independently auto-update active runners.

## Instructions and credentials

| Location | Responsibility |
| --- | --- |
| Project CLAUDE.md / AGENTS.md | Engine-agnostic architecture, layout, build/test commands, coding/data/API rules |
| Runner multica-claude.local.md | Workflow, agent roles, shared capabilities, evidence and human checkpoints |
| Runner JSON/native plugin configuration | Actual hooks, plugin pins, MCP settings and instruction-source exclusions |
| Private laptop/local files | Not copied or inherited by runners |

The launcher explicitly loads the custom policy file and passes it to delegated agents.
It excludes personal `CLAUDE.local.md`; setting-source flags alone do not exclude memory files.
Use clean checkouts and clean runner-owned settings, not laptop account state or an ignored personal AGENTS.md.
Certify native skill/plugin/MCP delivery under the actual headless engine; discovery alone does not prove execution.

Give each runner its own scoped credentials, persistent identity and working state.
Git writes are allowed. The agent commits, pushes a task branch, opens/updates a PR/MR and attaches its evidence.
Instructions prohibit merge, self-approval, default-branch push, shared-history force-push and automatic merge.
The owner accepts that this boundary is instructional. Do not invent a technical guarantee or require paid protection to proceed.
Keep credentials and private outputs out of source. Do not mount production Docker into coding jobs.

## Provider-neutral Git and local verification

Use normal Git remotes with GitHub, GitLab, Bitbucket, Gitea or another supported host.
The verification profile contains local commands and evidence paths, not a provider's CI syntax.
The publication adapter handles the host's PR/MR API or CLI. GitHub can use `gh`; GitLab can use `glab`.
Adding another provider must not change how tests run or how reports describe coverage.

No hosted workflow is required. No startup step queries rulesets or branch-protection endpoints.
Existing hosted CI may supply an extra check when available; it is not the source of local test evidence.
Native Git writes and PR publication are sufficient for the pilot. There is no mandatory protected publisher, signing service or manual publication gate.

Before PR creation, the agent runs the selected local profile on the candidate commit.
It records the mode, reason, exact SHA, commands, exit status, coverage and omitted cases.
It uses the shared template and Plain English skill, uploads screenshots and verifies the published description.
New commits require fresh relevant evidence. Humans review before merge.

## Workflows

### Feature development

1. Start with grill-with-docs. Read code/docs before asking factual questions. Resolve decisions with the human.
2. Create a task-specific INTENT.md. Do not overwrite an existing product-level intent.
3. Use Superpowers brainstorming with that intent. Compare approaches and record design and ADR.
4. Obtain design agreement, write the implementation/test plan, then obtain human plan approval before implementation handoff.
5. Use TDD: observe a meaningful failed test, implement the passing change, then refactor while green.
6. Add unit, contract and automation work as part of development. Run the selected local profile and publish evidence.

Use the documentation-and-adrs structure: Status, Date, Context, Decision, Alternatives and Consequences.
Retain each repository's ADR path/numbering. If a feature reuses the architecture, explain that decision and reference the existing ADR.

### Bug triage

Start with Superpowers systematic-debugging. Read errors, reproduce, trace boundaries and inspect recent changes.
Compare working cases. Test one clear hypothesis at a time. Do not propose a fix without a supported cause.
After the approved fix plan, add the failed regression test, implement and run local verification.
If three fixes fail, stop for architectural discussion. Report unresolved investigations honestly.

### Issue triage

Use the operator-supplied laptop TipTip issue-triage skill and its references.
Pin the target and absolute time window. Read the rule/history for alerts. Start with Loki, then its conditional Sentry/browser checks.
Inspect deployments and source at the deployed SHA, not HEAD. Preserve the skill's GitLab investigation when using that integration.
Write a private evidence-chain report with confirmed/probable/guess labels and real/noise/mis-tuned/unresolved outcomes.
Do not edit production, publish private evidence, push fixes or change alert rules from triage. A fix starts a separate approved code task.

## Parallel agents and repositories

Use a planner/lead, implementers and an independent reviewer. All use the same runner release.
Agree on API/event/schema contracts before parallel work. Give each task an owner, repo/module scope and acceptance tests.
Each agent uses its own worktree, branch, dependency environment and test services.
Serialize migrations, shared dependency changes, ADR numbering, conflicts and final integration.

Cross-repo work records the candidate SHA of each repository, the merge order and aggregate contract-test evidence.
One green repository does not prove the combined change. Use compatible sequencing and rollback; do not assume atomic multi-repo merges.
Start with one implementation job, measure peaks, then expand. Set agent and daemon concurrency explicitly rather than using native defaults.

## Test modes and evidence

Follow the [test policy](testing.md). Full regression is the default.
Fast mode is an approved smaller scope, not a claim that all regressions ran. Functional UI tests may be excluded only with that limit shown.
UI behavior, API contracts, authentication, migrations, dependency/runtime changes and unknown impact require full mode unless a reviewed repo policy proves otherwise.

Report unit line/branch coverage and integration/functional-UI scenario coverage separately.
Percentages need a named denominator and measured output. A screenshot is evidence, not a coverage percentage.
Do not report a missing suite, an empty test run or an unavailable instrument as a pass.

The [PR template](../templates/pull-request-description.md) includes intent/plan/ADR, result, reason, changes, coverage, mode, screenshots and review order.
Use the operator's pr-description and Plain English skills: active voice, common words, short sentences and no inflated claims.
Use the PR skill for structure and prose. The owner authorizes task-branch writes and PR/MR creation after the local checks pass.
That authorization replaces the laptop skill's per-push approval step; human plan and merge review remain required.
Use actual output in the body. Full reports may be linked from an approved store, but no hosted artifact service is required.

## Human checkpoints

Before implementation, review intent, alternatives/ADR, contracts, acceptance cases, coverage plan, task ownership, data risks and rollback.
Approval refers to the plan revision and scope. A material scope/design change returns to this checkpoint.

Before merge, review the behavioral diff, test changes, local results, screenshots and omitted cases.
Check that tests prove intent and were not weakened. Mechanical formatting should already be checked locally.
Keep the agent's merge prohibition in the runner policy. Do not describe it as a Git-server permission restriction.

## Pilot and rollout

The selected first repository is `rhapsodixx/ronda`. Its profile reuses local product gates and seeded browser smokes.
Ronda's TypeScript/Python work and Go scanner toolchain do not alone certify an independent Go application or all cross-repo cases.
Docker-heavy verification runs on dedicated test infrastructure with no production data. A code agent's Git permission does not authorize production changes.

Prepare and test the runner assets, then certify the image/private extensions, one real feature, one reproducible bug and a synthetic alert replay.
Measure human corrections, completion, resource peaks and evidence quality before expanding concurrency.

## Primary references

- [Multica runners](https://multica.ai/docs/daemon-runtimes), [skills](https://multica.ai/docs/skills), [MCP/agent configuration](https://multica.ai/docs/agents-create)
- [Multica execution boundary](https://multica.ai/docs/security-model)
- [Claude instruction loading](https://code.claude.com/docs/en/memory), [CLI flags](https://code.claude.com/docs/en/cli-reference)
- [GitHub CLI media attachments](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli)
