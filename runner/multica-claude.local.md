# Potato runner policy for Multica

This file belongs to the runner release. Project CLAUDE.md and AGENTS.md describe the repository, not the engine.
Do not inherit laptop CLAUDE.local.md, ignored AGENTS.md, personal settings, old session handoffs or another engine's rules.

## Work and Git

- Read the project intent, repository guidance, approved plan and test profile before work.
- Git writes are allowed: commit, push a task branch and create or update a pull request or merge request.
- Do not merge, approve your own change, push the default branch, force-push shared history or enable auto-merge.
- Human review is required before implementation handoff and before merge.
- These are agent instructions, not a claim that the Git server technically blocks the actions.
- No hosted workflow, branch-protection API, paid Git plan or GitHub-specific service is required.
- Use the repository's Git remote and matching client. Keep provider-specific commands out of the test profile.

## Workflows

- Feature: grill-with-docs first. Create a task-specific INTENT.md. Use Superpowers brainstorming with that intent.
  Keep one canonical task intent; preserve the product intent. Record the ADR or reference an applicable existing ADR.
  Obtain design agreement, write the implementation/test plan and obtain human plan approval.
  Then use TDD, implement the approved slices and verify the integrated result.
  Archive the task intent after completion and preserve its references in the final PR/MR.
- Bug: start with Superpowers systematic-debugging. Gather evidence and confirm the root cause before a fix.
  Add a regression test, observe its failure, apply the fix and verify it. Escalate after three failed fixes.
- Issue triage: use the operator-supplied TipTip issue-triage skill and references. Use Loki first, then its conditional
  Sentry/browser and deployed-source checks. Write an evidence-linked private report. Production stays read-only.
  Do not copy a private production report into a public repository or PR. A code fix starts a separate approved task.

## Shared tooling and parallel work

- Use the approved image, plugin/skill revisions and shared MCP catalog. Do not update the platform during a task.
- Use each repository's locked dependencies, compatible runtime and existing hook/test commands.
- Run SQL/secret checks, Gitleaks, lint, type/compile checks and the tests required by the profile.
- gopls helps Go navigation and diagnostics. It does not replace build, vet, lint or tests.
- Use separate worktrees, branches, dependency environments and test databases for parallel tasks.
- Agree on contracts and ownership before parallel implementation. Serialize shared migrations and final integration.
- Complete the repository readiness baseline before expanding concurrency. Reuse confirmed, tested CLI and browser drivers.
- Rank repeated corrections by frequency, impact and rework. Turn selected problems into API, lint/type or regression checks.
- Include good and bad examples. Keep refactoring within the affected feature and boundaries.
- Use statecharts for complex product behavior and test its transitions. Formal tools are not a default requirement.
- Agree on a review-pass limit in the plan. Return unresolved findings to the human when that limit is reached.
- Keep credentials scoped to the task. Do not copy a personal HOME or mount production Docker into coding jobs.

## Full and fast tests

- Default to full regression. Run the complete approved unit, integration/API and functional UI profile.
- Use fast mode only for repository-approved small or non-code changes. Do not use line count alone to decide.
- Fast mode may run unit tests and non-functional UI checks, such as component/type/build checks.
  State that functional UI regression did not run. Never call fast mode full regression.
- UI behavior, API contracts, authentication, migrations, dependency/runtime changes and unknown impact require full mode.
- Report line/branch coverage for unit tests and scenario coverage for integration and functional UI tests.
- Compare coverage with the approved baseline and report uncovered changed behavior. Do not invent a threshold or a percentage.
- Report unavailable coverage as not measured. Report excluded checks as not run. Never turn either into a pass.
- A required failed, skipped, timed-out or unavailable test blocks the PR. Docs-only work may use a documented non-code profile.

## PR evidence and tone

- Run the local checks before PR creation. Bind their output to the exact candidate commit.
- Validate the full SHA, clean source state, profile/release, mode, actual results, coverage and artifact contents mechanically.
  Use the repository evidence validator when available. A JSON file or a claimed pass is insufficient.
  Report a missing validator as a readiness gap; do not claim it has run or invent a pass.
- Use the shared PR template, the pr-description method and the Plain English skill.
- The owner authorizes task-branch writes and PR publication after checks pass. This replaces the laptop PR skill's per-push approval step.
- Include the mode and selection reason, coverage by layer, actual commands/counts, limitations and tested SHA.
- Put a short actual-output block in the description. Attach synthetic-data screenshots for visual changes.
- Upload images with a supported Git client or link an approved accessible artifact. Do not commit screenshots to source by default.
- Re-read the published PR. Check its head, evidence and description. Repair partial uploads in the same PR.
- Re-run affected checks and replace stale evidence after new commits or integration changes.
- Record reverts, fix-forward changes, escaped defects, human rework and relevant product performance for rollout review.
- Write the main point first. Use active voice, common words and one idea per sentence.
  Keep descriptions to 25 words per sentence and instructions to 20. Use explicit times.
  Do not use inflated claims, contractions, idioms, emojis or filler. Keep commands, IDs and URLs exact.

## Data and operations

- Use synthetic fixtures. Do not publish secrets, personal data, private skill contents or real production findings.
- SQL command guards supplement actual database permissions. Shared databases require read-only access.
  Disposable local test databases may use the fixture/migration operations allowed by the test profile.
- Do not deploy, restart, change production settings, mutate production data or delete shared resources without a separate explicit request.
