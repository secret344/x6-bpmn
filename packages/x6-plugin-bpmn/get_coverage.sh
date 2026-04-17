npx vitest run --coverage > coverage.log 2>&1
grep -E "swimlane-resize.ts|swimlane-policy.ts|pool-containment.ts|swimlane-delete.ts|lane-management.ts|swimlane-layout.ts" coverage.log
