# Intent

Build Potato, a repeatable agent framework for a product engineering team.
Agents should develop features, investigate bugs and triage production issues with evidence.

## Decisions

- Use Multica and Claude Code. Do not use MausBot as a baseline or dependency.
- Run pinned runner containers on dedicated VMs. Keep execution separate from the coordinator's production services.
- Give all runners the same approved skills, plugins, MCP definitions and toolchain catalog.
- Keep project instructions engine-agnostic. Use a runner-owned `multica-claude.local.md` for the operating workflow.
- Support TypeScript, Go, Python and multiple repositories with different locked project dependencies.
- Support parallel agents through agreed contracts and separate worktrees, branches and test services.
- Run checks locally. Hosted CI, GitHub rulesets and branch protection are not prerequisites.
- Allow agent Git writes and PR/MR publication. Agent instructions require human merge; this is an accepted trust model.
- Include exact-commit test results, coverage, mode and visual evidence in each code PR/MR.
- Use full regression by default. Fast mode is a declared, approved smaller profile, never a hidden regression shortcut.
- Use the Potato pyramid: codebase, static analysis, verification, prose, then human review.
- Make Ronda ready before scaling runners. Rank repeated corrections and replace them with executable checks where practical.
- Validate evidence against the tested commit, clean state, approved profile and actual artifacts before publication.

## First pilot

Use `rhapsodixx/ronda`. Reuse its local gate and synthetic browser tests through a repository profile.
Start with its [repository readiness work](docs/repository-readiness.md) and the minimum runner needed to prove that work.
The platform itself must work with GitHub, GitLab, Bitbucket and other Git hosts.
The pilot does not authorize changes to its production installation.

## This repository now

Track the strategy, reusable runner policy, PR template and tested configuration-preparation helpers before rollout.
Do not claim that a runner image, private skill bundle or deployed workflow has been certified.
