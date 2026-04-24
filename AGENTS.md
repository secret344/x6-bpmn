# Repository Agent Rules

These rules apply to all AI coding agents in this workspace.

## Scope and Priority
- Follow this file first for repo-wide behavior.
- For package-specific work, also follow local instruction files.
- If rules conflict, use the stricter testing requirement.

## BPMN Specification Authority
- For BPMN semantics, constraints, rule text, and behavioral conclusions, use `packages/bpmn2-spec/formal-11-01-03.pdf` as the final authority.
- If repository descriptions, comments, tests, extracted notes, or secondary references disagree, re-check the PDF source text and align the code and wording to the PDF.
- Treat `packages/bpmn2-spec/BPMN2_详细规范/` as a supporting reference only; if it differs from the PDF, the PDF wins.
- Do not present a BPMN rule as a normative restriction unless the PDF text supports that conclusion. If the PDF is silent or only weakly suggestive, label the behavior as implementation policy or current product behavior instead.

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
- Treat `/* istanbul ignore */` and `/* v8 ignore */` as last-resort tools, not normal workflow.
- Before adding a new ignore, first try to cover the branch with a business-realistic test or remove the dead code.
- Any newly added ignore must include an inline reason comment explaining why the branch is unreachable, tool-miscounted, or otherwise not worth a real scenario.
- When touching historical ignores, review whether they are still necessary and delete them if a meaningful test can replace them.
- Headless browser tests must generate and assert visual snapshots; artifact-only screenshots are not sufficient verification.
- Browser regression specs must live under `packages/x6-plugin-bpmn/tests/browser/*.spec.ts` and reuse the existing spec file when the scenario belongs to the same behavior area; do not create parallel duplicate spec files for the same regression theme.
- Snapshot baselines for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/<spec-file>.ts-snapshots/`, grouped by test-case folders.
- Runtime screenshot artifacts for a browser spec must live only under `packages/x6-plugin-bpmn/tests/browser/artifacts/screenshots/`, grouped by the same test-case folders.
- Runtime screenshot artifacts must be generated directly into that fixed artifact directory during test execution so they remain available for manual verification.
- Do not create extra flat files, sibling snapshot folders, or alternate artifact directories for an existing browser spec, and do not rely on post-run moving or cleanup to normalize screenshot locations.
- Browser spec files should be organized by business domain: containment/drag behavior in one spec, swimlane resize behavior in another, connection rules in another, etc. Do not force all browser tests into a single spec file.
- Direct drag (`node:moved`) and selection drag (`batch:stop` `move-selection`) are distinct interaction paths; create separate test cases for each when the behavior differs.
- Generated spec file names must not duplicate any existing spec file name in the browser test directory.
- When an architectural issue is discovered that a patch cannot cleanly fix, thorough refactoring is permitted and encouraged over incremental workarounds.

## 风险敏感区域 / Risk-sensitive Areas
- 修改 `docs/swimlane-resize-risk-guards.md` 中定义的任一风险区前，必须先阅读该文档，并明确本次变更依赖的关键假设。
	Before changing any risk-sensitive area documented in `docs/swimlane-resize-risk-guards.md`, read that document first and make the key assumption for the change explicit.
- 若变更命中该文档中的任一风险区，最终汇报或 PR 摘要必须警示：触碰了哪项风险、底层假设是否保持不变、以及重新运行了哪些定向验证。
	If a change touches any risk area from that document, the final report or PR summary must warn which risk was touched, whether the underlying assumption was preserved, and which targeted validations were rerun.
- 若变更修改的是假设本身而不是单纯实现细节，必须在同一变更中同步更新 `docs/swimlane-resize-risk-guards.md`。
	If the change modifies the assumption itself rather than only the implementation detail, update `docs/swimlane-resize-risk-guards.md` in the same change.

## Submodule Policy
- Do not directly modify content inside git submodules under `packages/**`.
- Current reference/documentation submodules include `packages/bpmn2-spec`, `packages/bpmn-moddle`, and `packages/bpmn-js`.
- Use `packages/bpmn2-spec` as the specification reference, `packages/bpmn-moddle` as the BPMN 2.0 XML modeling/reference implementation, and `packages/bpmn-js` as the community BPMN designer/reference implementation when investigating behavior or design questions.
- If a submodule appears wrong, incomplete, or needs follow-up, record the issue in root `tip.md` instead of editing the submodule in this workspace.

## Non-plugin Packages
- For changes outside `x6-plugin-bpmn`, state why automated tests are not run, or run an applicable verification step.
- Do not claim coverage guarantees for demo packages without a real test suite.
