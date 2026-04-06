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

## Submodule policy
- Do not directly modify content inside git submodules under `packages/**`.
- Reference and documentation submodules must remain read-only in this workspace.
- Use `packages/bpmn2-spec` for spec lookup, `packages/bpmn-moddle` for BPMN XML/moddle behavior lookup, and `packages/bpmn-js` for community modeler behavior lookup when implementation questions arise.
- If a submodule problem is found, record it in root `tip.md` instead of editing the submodule.

## Pre-submit checklist
1. Code change mapped to a concrete business behavior.
2. Test updates map to that behavior.
3. Required test command executed.
4. Result summary captured in final report.
