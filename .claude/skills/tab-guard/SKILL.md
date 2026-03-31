```markdown
# tab-guard Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill teaches you the core development patterns, coding conventions, and workflows used in the `tab-guard` JavaScript codebase. `tab-guard` is a browser extension project focused on managing browser tabs, featuring modular JavaScript, UI components (popup, dashboard), and extension branding. This guide covers how to add new modules with tests, develop UI features, update branding, and follow the project's code style.

## Coding Conventions

- **Language:** JavaScript (no framework)
- **File Naming:** Use `camelCase` for files (e.g., `utils.js`, `tabManager.js`)
- **Import Style:** Always use relative imports.
  ```js
  import { getTabs } from './utils.js';
  ```
- **Export Style:** Use named exports.
  ```js
  // src/utils.js
  export function getTabs() { /* ... */ }
  export function closeTab(id) { /* ... */ }
  ```
- **Commit Messages:** Use [Conventional Commits](https://www.conventionalcommits.org/) with the `feat` prefix for features.
  ```
  feat: add storage abstraction for session management
  ```
- **Directory Structure:**
  ```
  tab-guard/
    src/
      utils.js
      storage.js
      popup/
        popup.js
        popup.html
        popup.css
      dashboard/
        dashboard.js
        dashboard.html
        dashboard.css
    tests/
      utils.test.js
      storage.test.js
    icons/
      icon16.png
      icon48.png
      icon128.png
    manifest.json
    README.md
    .gitignore
  ```

## Workflows

### Add New Module with Tests
**Trigger:** When introducing a new isolated functionality (utility, helper, storage, etc.) that needs unit tests.  
**Command:** `/new-module-with-tests`

1. **Create the module file** in `src/`, e.g., `src/utils.js`.
2. **Create the corresponding test file** in `tests/`, e.g., `tests/utils.test.js`.
3. **Implement the module functionality** using named exports.
   ```js
   // src/utils.js
   export function sum(a, b) {
     return a + b;
   }
   ```
4. **Write unit tests** for all exported functions.
   ```js
   // tests/utils.test.js
   import { sum } from '../src/utils.js';

   test('sum adds two numbers', () => {
     expect(sum(2, 3)).toBe(5);
   });
   ```

### Feature Development: UI Logic, CSS, HTML
**Trigger:** When adding or updating a UI feature (e.g., popup, dashboard).  
**Command:** `/new-ui-feature`

1. **Create or update JavaScript logic** for the feature, e.g., `src/popup/popup.js`.
2. **Create or update the HTML file** for the feature, e.g., `src/popup/popup.html`.
3. **Create or update the CSS file** for the feature, e.g., `src/popup/popup.css`.
4. **Wire up logic to UI elements** using DOM APIs.
   ```js
   // src/popup/popup.js
   document.getElementById('closeBtn').addEventListener('click', () => {
     // close tab logic
   });
   ```
5. **Test the UI manually** in the browser extension popup or dashboard.

### Update Extension Branding and Assets
**Trigger:** When changing the extension's appearance, branding, or preparing for a release.  
**Command:** `/update-branding`

1. **Update icon PNG files** in the `icons/` directory.
2. **Edit `manifest.json`** to update metadata (description, permissions, URLs).
3. **Update CSS/HTML files** for branding changes (colors, headers, etc.).
4. **Update or add `README.md`** and `.gitignore` as needed.
5. **Preview changes** in the browser extension to verify branding updates.

## Testing Patterns

- **Test File Naming:** Place tests in `tests/` with `.test.js` suffix (e.g., `utils.test.js`).
- **Test Framework:** Not explicitly specified; use standard JavaScript test runners (e.g., Jest or Mocha).
- **Test Structure:** Import functions using relative paths and write unit tests for each exported function.
  ```js
  // tests/storage.test.js
  import { saveData, loadData } from '../src/storage.js';

  test('saveData stores and retrieves data', () => {
    saveData('key', 'value');
    expect(loadData('key')).toBe('value');
  });
  ```

## Commands

| Command                | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| /new-module-with-tests | Add a new JavaScript module with corresponding unit tests       |
| /new-ui-feature        | Implement a new UI feature (JS logic, HTML, CSS)               |
| /update-branding       | Update extension branding, icons, manifest, and documentation   |
```