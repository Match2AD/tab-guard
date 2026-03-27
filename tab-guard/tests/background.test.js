// tab-guard/tests/background.test.js
// Run with: node tests/background.test.js

// ── crypto.randomUUID polyfill for Node ─────────────────────────────────────
if (!globalThis.crypto) {
  const { webcrypto } = await import('node:crypto');
  globalThis.crypto = webcrypto;
}

// ── Mock chrome APIs ─────────────────────────────────────────────────────────
const store = {};
const alarms = {};
const listeners = {
  tabsOnRemoved: [],
  tabsOnUpdated: [],
  windowsOnRemoved: [],
  runtimeOnStartup: [],
  runtimeOnInstalled: [],
  alarmsOnAlarm: [],
};

globalThis.chrome = {
  storage: {
    local: {
      get: (keys) =>
        Promise.resolve(
          keys.reduce((acc, k) => {
            if (store[k] !== undefined) acc[k] = store[k];
            return acc;
          }, {})
        ),
      set: (obj) => {
        Object.assign(store, obj);
        return Promise.resolve();
      },
      getBytesInUse: () => Promise.resolve(JSON.stringify(store).length),
    },
  },
  tabs: {
    onRemoved: { addListener: (fn) => listeners.tabsOnRemoved.push(fn) },
    onUpdated: { addListener: (fn) => listeners.tabsOnUpdated.push(fn) },
  },
  windows: {
    onRemoved: { addListener: (fn) => listeners.windowsOnRemoved.push(fn) },
    getAll: () =>
      Promise.resolve([
        {
          id: 1,
          incognito: false,
          type: 'normal',
          tabs: [
            {
              url: 'https://example.com',
              title: 'Example',
              favIconUrl: '',
              index: 0,
              pinned: false,
            },
          ],
        },
      ]),
  },
  runtime: {
    onStartup: { addListener: (fn) => listeners.runtimeOnStartup.push(fn) },
    onInstalled: { addListener: (fn) => listeners.runtimeOnInstalled.push(fn) },
  },
  alarms: {
    create: (name, opts) => {
      alarms[name] = opts;
    },
    onAlarm: { addListener: (fn) => listeners.alarmsOnAlarm.push(fn) },
  },
};

// ── Import module under test (registers all listeners as a side-effect) ──────
// Use dynamic import so chrome mock is set up before module-level code runs.
const { snapshotAllWindows } = await import('../src/background.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

// ── snapshotAllWindows() ─────────────────────────────────────────────────────
console.log('\nsnapshotAllWindows()');

// Clear store before test
for (const key of Object.keys(store)) {
  delete store[key];
}

await snapshotAllWindows();

const tgSnapshots = store['tg_snapshots'];

assert(Array.isArray(tgSnapshots), 'creates tg_snapshots as an array');
assert(tgSnapshots.length === 1, 'creates one snapshot for the one normal window');
assert(tgSnapshots[0].tabs.length === 1, 'snapshot has 1 tab');
assert(
  tgSnapshots[0].tabs[0].url === 'https://example.com',
  'snapshot tab URL is correct'
);

// ── Event listeners registered ───────────────────────────────────────────────
console.log('\nEvent listeners registered');

assert(
  listeners.tabsOnRemoved.length >= 1,
  'tabs.onRemoved has at least one listener'
);
assert(
  listeners.tabsOnUpdated.length >= 1,
  'tabs.onUpdated has at least one listener'
);
assert(
  listeners.windowsOnRemoved.length >= 1,
  'windows.onRemoved has at least one listener'
);
assert(
  listeners.runtimeOnStartup.length >= 1,
  'runtime.onStartup has at least one listener'
);
assert(
  listeners.runtimeOnInstalled.length >= 1,
  'runtime.onInstalled has at least one listener'
);

// ── Alarm created ────────────────────────────────────────────────────────────
console.log('\nAlarm created');

// Trigger onInstalled to create the alarm
listeners.runtimeOnInstalled.forEach((fn) => fn());

// Allow microtasks (snapshotAllWindows is async inside listener)
await new Promise((resolve) => setTimeout(resolve, 50));

assert(
  alarms['tg-daily-cleanup'] !== undefined,
  'tg-daily-cleanup alarm was created'
);
assert(
  alarms['tg-daily-cleanup'].periodInMinutes === 1440,
  'alarm has periodInMinutes=1440'
);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
