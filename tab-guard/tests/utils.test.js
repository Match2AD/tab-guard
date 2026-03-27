// tab-guard/tests/utils.test.js
// Run with: node tests/utils.test.js

import {
  generateId,
  formatRelativeTime,
  formatDateHeading,
  deduplicateSnapshots,
} from '../src/utils.js';

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

// ── generateId ──────────────────────────────────────────────────────────────
console.log('\ngenerateId()');

const id1 = generateId();
const id2 = generateId();

assert(typeof id1 === 'string', 'returns a string');
assert(id1.length > 0, 'is non-empty');
assert(id1 !== id2, 'two calls return different values');

// ── formatRelativeTime ───────────────────────────────────────────────────────
console.log('\nformatRelativeTime(timestamp)');

const now = Date.now();

assert(
  formatRelativeTime(now - 30_000) === 'vor weniger als 1 Min.',
  '30 seconds ago → "vor weniger als 1 Min."'
);
assert(
  formatRelativeTime(now - 3 * 60_000) === 'vor 3 Min.',
  '3 minutes ago → "vor 3 Min."'
);
assert(
  formatRelativeTime(now - 2 * 3_600_000) === 'vor 2 Std.',
  '2 hours ago → "vor 2 Std."'
);
assert(
  formatRelativeTime(now - 25 * 3_600_000) === 'vor 1 Tag',
  '25 hours ago → "vor 1 Tag"'
);
assert(
  formatRelativeTime(now - 3 * 86_400_000) === 'vor 3 Tagen',
  '3 days ago → "vor 3 Tagen"'
);

// ── formatDateHeading ────────────────────────────────────────────────────────
console.log('\nformatDateHeading(timestamp)');

const todayTs = Date.now();
const yesterdayTs = Date.now() - 86_400_000;
const threeDaysAgoTs = Date.now() - 3 * 86_400_000;

assert(formatDateHeading(todayTs) === 'Heute', 'today → "Heute"');
assert(formatDateHeading(yesterdayTs) === 'Gestern', 'yesterday → "Gestern"');

const threeDaysResult = formatDateHeading(threeDaysAgoTs);
assert(
  threeDaysResult !== 'Heute' && threeDaysResult !== 'Gestern',
  '3 days ago → German formatted date (not "Heute" or "Gestern")'
);

// ── deduplicateSnapshots ─────────────────────────────────────────────────────
console.log('\ndeduplicateSnapshots(snapshots)');

const snap1 = {
  windowId: 100,
  tabs: [{ url: 'https://a.com' }],
  timestamp: 1000,
};
const snap2 = {
  windowId: 100,
  tabs: [{ url: 'https://a.com' }],
  timestamp: 2000,
};
const snap3 = {
  windowId: 100,
  tabs: [{ url: 'https://b.com' }],
  timestamp: 3000,
};

const result = deduplicateSnapshots([snap1, snap2, snap3]);

assert(result.length === 2, 'returns 2 entries (removes older duplicate)');
assert(
  result.some((s) => s.timestamp === 2000),
  'keeps newer of duplicates (snap2 with ts:2000)'
);
assert(
  !result.some((s) => s.timestamp === 1000),
  'removes older duplicate (snap1 with ts:1000)'
);
assert(
  result.some((s) => s.timestamp === 3000),
  'keeps snapshot with different tabs (snap3)'
);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
