# Claude Project Constraints

This file aligns Claude behavior with repository agent rules.

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
- Headless browser tests must generate and assert visual snapshots; artifact-only screenshots are not sufficient verification.
- Browser regression specs must live under `packages/x6-plugin-bpmn/tests/browser/*.spec.ts` and reuse the existing spec file when the scenario belongs to the same behavior area; do not create parallel duplicate spec files for the same regression theme.
- Snapshot baselines for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/<spec-file>.ts-snapshots/`, grouped by test-case folders.
- Runtime screenshot artifacts for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/artifacts/screenshots/`, grouped by the same test-case folders.
- Runtime screenshot artifacts must be generated directly into that fixed artifact directory during test execution so they remain available for manual verification.
- Do not create extra flat files, sibling snapshot folders, or alternate artifact directories for an existing browser spec, and do not rely on post-run moving or cleanup to normalize screenshot locations.

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
