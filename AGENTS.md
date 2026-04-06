# Repository Agent Rules

These rules apply to all AI coding agents in this workspace.

## Scope and Priority
- Follow this file first for repo-wide behavior.
- For package-specific work, also follow local instruction files.
- If rules conflict, use the stricter testing requirement.

## Codex and Claude Alignment
- Keep `.codex/CODEX.md` and `.claude/CLAUDE.md` consistent with this file.
- If any quality gate changes here, update both Codex and Claude constraint files in the same change.

## Required Change Workflow
1. Identify business behavior changed by the edit.
2. Add or update tests that validate that business behavior.
3. Run required tests before finishing the task.
4. Report the executed commands and result summary.

## Mandatory Test Validation
- Any change under `packages/x6-plugin-bpmn/src/**` must run tests in `packages/x6-plugin-bpmn`.
- Preferred command for cross-module or risky changes: `npm run test:coverage` in `packages/x6-plugin-bpmn`.
- Minimum command for small, isolated changes: `npm run test` in `packages/x6-plugin-bpmn`.

## Coverage and Test Quality
- Keep coverage thresholds at 100% as configured in Vitest.
- Do not add synthetic tests that only chase coverage numbers.
- Every new test must map to a real BPMN or SmartEngine business rule, export path, adapter behavior, or regression scenario.
- If a branch is hard to test, explain the business reason and add the closest meaningful scenario instead of artificial assertions.
- Headless browser tests must generate and assert visual snapshots; artifact-only screenshots are not sufficient verification.
- Browser regression specs must live under `packages/x6-plugin-bpmn/tests/browser/*.spec.ts` and reuse the existing spec file when the scenario belongs to the same behavior area; do not create parallel duplicate spec files for the same regression theme.
- Snapshot baselines for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/<spec-file>.ts-snapshots/`, grouped by test-case folders.
- Runtime screenshot artifacts for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/artifacts/screenshots/`, grouped by the same test-case folders.
- Runtime screenshot artifacts must be generated directly into that fixed artifact directory during test execution so they remain available for manual verification.
- Do not create extra flat files, sibling snapshot folders, or alternate artifact directories for an existing browser spec, and do not rely on post-run moving or cleanup to normalize screenshot locations.

## Submodule Policy
- Do not directly modify content inside git submodules under `packages/**`.
- Current reference/documentation submodules include `packages/bpmn2-spec`, `packages/bpmn-moddle`, and `packages/bpmn-js`.
- Use `packages/bpmn2-spec` as the specification reference, `packages/bpmn-moddle` as the BPMN 2.0 XML modeling/reference implementation, and `packages/bpmn-js` as the community BPMN designer/reference implementation when investigating behavior or design questions.
- If a submodule appears wrong, incomplete, or needs follow-up, record the issue in root `tip.md` instead of editing the submodule in this workspace.

## Non-plugin Packages
- For changes outside `x6-plugin-bpmn`, state why automated tests are not run, or run an applicable verification step.
- Do not claim coverage guarantees for demo packages without a real test suite.
