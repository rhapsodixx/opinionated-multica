# Potato Setup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for the installer. Independent documentation and image packaging have scoped owners. Use TDD for behavior changes and a fresh whole-change review.

**Goal:** Rename the framework to Potato, apply the approved strategy review, and provide an animated npx/shell setup command.

**Architecture:** One Node CLI builds and verifies a container image, then reuses the Python bundle helper inside it. No login or startup occurs.

**Tech Stack:** Node 22.8+ standard library, Python helpers, Docker, Bash, Node test runner and coverage.py.

**Spec:** ../specs/2026-11-22-potato-installer-design.md

## Global constraints

- Native Git writes allowed; human plan approval and human merge remain required.
- No hosted workflow/protection prerequisite; command blocking and independent verifier remain separate proposals.
- No npm/image publication or service deployment in this task.
- Preserve private plugin contents and credentials outside Git.

## Review focus

- Missing Docker daemon or Compose must stop before a build.
- No token contents enter arguments or logs; paths with spaces work.
- Existing output must not be overwritten; failed commands stop subsequent work.
- The image doctor checks the actual tools; no fake product verification claim.
- A packaged GitHub npx install must contain every file required by the build context.

## Tasks

- [x] 1. Apply approved Phase0, correction checks, feature maps, statecharts, evidence and metrics to strategy and tracking.
- [x] 2. Pin image sources and implement container build assets; document extension/runtime acceptance limits.
- [x] 3. Write failing Node tests for validation, plan mode, prerequisites, build/doctor/preparation failures and no startup.
- [x] 4. Implement the smallest CLI and shell wrapper that pass those tests. Extend the Python image validator for local immutable image IDs.
- [x] 5. Add the square generated logo, update Potato copy and setup instructions; inspect packaged files and terminal output.
- [x] 6. Run full Python/Node checks, coverage and secret scan. Obtain a fresh review, fix important findings, then commit/push and update tracking issues.
