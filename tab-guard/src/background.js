/**
 * Service Worker (background script) for Tab Guard.
 *
 * Listens to Chrome tab/window events and maintains window snapshots in
 * storage. Uses 2 s debouncing to batch rapid successive changes.
 */

import { saveSnapshot, getSnapshots, addClosedWindow, removeOldSnapshots } from './storage.js';
import { generateId } from './utils.js';

const DEBOUNCE_MS = 2000;
const RETENTION_DAYS = 30;
const CLEANUP_ALARM = 'tg-daily-cleanup';

let debounceTimer = null;

/**
 * Returns true for windows that should be tracked (non-incognito, type normal).
 * @param {{ type: string, incognito: boolean }} win
 * @returns {boolean}
 */
function isTrackableWindow(win) {
  return win.type === 'normal' && !win.incognito;
}

/**
 * Builds an immutable snapshot object from a Chrome window with tabs populated.
 * @param {{ id: number, tabs: Array }} win
 * @returns {{ id: string, windowId: number, timestamp: number, tabs: Array }}
 */
function buildWindowSnapshot(win) {
  return {
    id: generateId(),
    windowId: win.id,
    timestamp: Date.now(),
    tabs: (win.tabs || []).map((tab) => ({
      url: tab.url || '',
      title: tab.title || '',
      favIconUrl: tab.favIconUrl || '',
      index: tab.index,
      pinned: tab.pinned || false,
    })),
  };
}

/**
 * Takes a snapshot of every trackable window currently open and saves them
 * to storage. Windows without tabs are skipped.
 *
 * @returns {Promise<void>}
 */
export async function snapshotAllWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  for (const win of windows) {
    if (!isTrackableWindow(win)) continue;
    if (!win.tabs || win.tabs.length === 0) continue;
    const snapshot = buildWindowSnapshot(win);
    await saveSnapshot(snapshot);
  }
}

/**
 * Schedules a debounced call to snapshotAllWindows.
 * Multiple rapid events within DEBOUNCE_MS will only trigger one snapshot.
 */
function debouncedSnapshot() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    snapshotAllWindows();
    debounceTimer = null;
  }, DEBOUNCE_MS);
}

// ── Event listeners ───────────────────────────────────────────────────────────

chrome.tabs.onRemoved.addListener(() => {
  debouncedSnapshot();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.title) {
    debouncedSnapshot();
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  const snapshots = await getSnapshots();
  const closedSnap = snapshots.find((s) => s.windowId === windowId);
  if (closedSnap) {
    await addClosedWindow({ ...closedSnap, timestamp: Date.now() });
  }
  debouncedSnapshot();
});

chrome.runtime.onStartup.addListener(() => {
  snapshotAllWindows();
});

chrome.runtime.onInstalled.addListener(() => {
  snapshotAllWindows();
  chrome.alarms.create(CLEANUP_ALARM, { periodInMinutes: 1440 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CLEANUP_ALARM) {
    removeOldSnapshots(RETENTION_DAYS);
  }
});
