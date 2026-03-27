// tab-guard/tests/storage.test.js
// Run with: node --experimental-vm-modules tests/storage.test.js
// or: node tests/storage.test.js (Node 22+)

// ── Mock chrome.storage.local for Node.js testing ───────────────────────────
const store = {};
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
};

import {
  saveSnapshot,
  getSnapshots,
  addClosedWindow,
  getClosedWindows,
  removeOldSnapshots,
  getStorageUsage,
} from '../src/storage.js';

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

async function resetStore() {
  // Clear all keys from the in-memory store between tests
  for (const key of Object.keys(store)) {
    delete store[key];
  }
}

// ── saveSnapshot / getSnapshots ──────────────────────────────────────────────
console.log('\nsaveSnapshot(snap) / getSnapshots()');

await resetStore();

const snap1 = { windowId: 1, timestamp: Date.now(), tabs: ['https://example.com'] };
await saveSnapshot(snap1);
const snapshots1 = await getSnapshots();

assert(Array.isArray(snapshots1), 'getSnapshots returns an array');
assert(snapshots1.length === 1, 'returns one snapshot after saveSnapshot');
assert(snapshots1[0].windowId === 1, 'saved snapshot has correct windowId');
assert(Array.isArray(snapshots1[0].tabs), 'saved snapshot has tabs array');

// ── saveSnapshot with existing windowId (update, not duplicate) ──────────────
console.log('\nsaveSnapshot with existing windowId (upsert)');

const snap1Updated = {
  windowId: 1,
  timestamp: Date.now(),
  tabs: ['https://example.com', 'https://updated.com'],
};
await saveSnapshot(snap1Updated);
const snapshotsAfterUpdate = await getSnapshots();

assert(
  snapshotsAfterUpdate.length === 1,
  'does not add duplicate — still one entry after update'
);
assert(
  snapshotsAfterUpdate[0].tabs.length === 2,
  'updated snapshot replaces old one with new tab count'
);

// ── addClosedWindow / getClosedWindows ───────────────────────────────────────
console.log('\naddClosedWindow(snap) / getClosedWindows()');

await resetStore();

const closedSnap = {
  windowId: 42,
  timestamp: Date.now(),
  tabs: ['https://closed.com'],
};
await addClosedWindow(closedSnap);
const closedWindows = await getClosedWindows();

assert(Array.isArray(closedWindows), 'getClosedWindows returns an array');
assert(closedWindows.length === 1, 'returns one closed window after addClosedWindow');
assert(closedWindows[0].windowId === 42, 'closed window has correct windowId');

// Adding a second closed window — newest should be first (unshift)
const closedSnap2 = {
  windowId: 43,
  timestamp: Date.now(),
  tabs: ['https://second-closed.com'],
};
await addClosedWindow(closedSnap2);
const closedWindows2 = await getClosedWindows();

assert(closedWindows2.length === 2, 'has two closed windows after second add');
assert(
  closedWindows2[0].windowId === 43,
  'newest closed window is first (prepended)'
);

// ── removeOldSnapshots ───────────────────────────────────────────────────────
console.log('\nremoveOldSnapshots(maxDays)');

await resetStore();

const now = Date.now();
const msPerDay = 24 * 60 * 60 * 1000;

const oldSnap = { windowId: 10, timestamp: now - 31 * msPerDay, tabs: [] };
const recentSnap = { windowId: 11, timestamp: now - 1 * msPerDay, tabs: [] };

await saveSnapshot(oldSnap);
await saveSnapshot(recentSnap);

// Also add old/recent to closed windows
const oldClosed = { windowId: 20, timestamp: now - 31 * msPerDay, tabs: [] };
const recentClosed = { windowId: 21, timestamp: now - 1 * msPerDay, tabs: [] };
await addClosedWindow(oldClosed);
await addClosedWindow(recentClosed);

await removeOldSnapshots(30);

const snapshotsAfterPrune = await getSnapshots();
const closedAfterPrune = await getClosedWindows();

assert(
  snapshotsAfterPrune.length === 1,
  'removes 31-day-old snapshot, keeps recent one'
);
assert(
  snapshotsAfterPrune[0].windowId === 11,
  'kept snapshot is the recent one (windowId 11)'
);
assert(
  closedAfterPrune.length === 1,
  'removes 31-day-old closed window, keeps recent one'
);
assert(
  closedAfterPrune[0].windowId === 21,
  'kept closed window is the recent one (windowId 21)'
);

// ── getStorageUsage ──────────────────────────────────────────────────────────
console.log('\ngetStorageUsage()');

await resetStore();

// Pre-populate so usage > 0
await saveSnapshot({ windowId: 99, timestamp: Date.now(), tabs: ['https://test.com'] });

const usage = await getStorageUsage();

assert(typeof usage === 'number', 'getStorageUsage returns a number');
assert(usage > 0, 'storage usage is positive when data is present');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
