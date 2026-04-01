---
applyTo: "**"
description: "Global coding rules for this monorepo with strict business-driven test validation."
---

# Copilot Workspace Instructions

## Core policy
- Treat test validation as required work, not optional cleanup.
- For `packages/x6-plugin-bpmn`, validate every adjustment with test execution before completion.

## Required commands for plugin changes
Run in `packages/x6-plugin-bpmn`:
- `npm run test` for focused low-risk changes.
- `npm run test:coverage` for feature changes, refactors, rule updates, adapter changes, and export/import behavior updates.

## Test authoring constraints
- Tests must be business-related and scenario-based.
- Good tests cover real behavior such as boundary attach rules, dialect detection, BPMN XML export semantics, and shape/rule integration.
- Reject tests that only assert implementation details without business value.
- Reject tests added only to force 100% without representing real user or engine behavior.

## Coverage target
- Maintain configured 100% thresholds in plugin Vitest config.
- If coverage fails, prefer adding meaningful business scenarios over brittle branch-mocking tests.

## Completion checklist for plugin edits
1. Updated code and related business tests.
2. Executed required test command(s).
3. Reported command list and pass/fail outcome in the final response.
