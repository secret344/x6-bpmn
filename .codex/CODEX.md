# Codex Project Constraints

This file aligns Codex behavior with repository agent rules.

## Non-negotiable quality gates
- For any `packages/x6-plugin-bpmn` logic change, run tests before completion.
- Coverage should remain aligned with configured 100% thresholds.
- New tests must be tied to real business behavior, not synthetic line coverage.

## Required command set
In `packages/x6-plugin-bpmn`:
- `npm run test`
- `npm run test:coverage` (required for substantial logic updates)

## Test design rules
- Cover realistic BPMN/SmartEngine scenarios.
- Prefer domain outcome assertions over implementation-detail assertions.
- Do not add tests that exist only to satisfy coverage percentages.

## Pre-submit checklist
1. Code change mapped to a concrete business behavior.
2. Test updates map to that behavior.
3. Required test command executed.
4. Result summary captured in final report.
