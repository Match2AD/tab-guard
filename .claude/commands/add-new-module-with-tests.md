---
name: add-new-module-with-tests
description: Workflow command scaffold for add-new-module-with-tests in tab-guard.
allowed_tools: ["Bash", "Read", "Write", "Grep", "Glob"]
---

# /add-new-module-with-tests

Use this workflow when working on **add-new-module-with-tests** in `tab-guard`.

## Goal

Adds a new JavaScript module (utility/helper/storage/etc) along with corresponding unit tests.

## Common Files

- `tab-guard/src/utils.js`
- `tab-guard/tests/utils.test.js`
- `tab-guard/src/storage.js`
- `tab-guard/tests/storage.test.js`

## Suggested Sequence

1. Understand the current state and failure mode before editing.
2. Make the smallest coherent change that satisfies the workflow goal.
3. Run the most relevant verification for touched files.
4. Summarize what changed and what still needs review.

## Typical Commit Signals

- Create new module file in src/ (e.g., src/utils.js, src/storage.js)
- Create corresponding test file in tests/ (e.g., tests/utils.test.js, tests/storage.test.js)
- Implement module functionality
- Write unit tests for all exported functions

## Notes

- Treat this as a scaffold, not a hard-coded script.
- Update the command if the workflow evolves materially.