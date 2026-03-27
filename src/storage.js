/**
 * Storage module for Tab Guard.
 * The ONLY module that interacts with chrome.storage.local.
 *
 * Manages two storage keys:
 *   tg_snapshots      – current window snapshots (upserted on browser events)
 *   tg_closed_windows – recently closed windows (prepended on window close)
 */

const SNAPSHOTS_KEY = 'tg_snapshots';
const CLOSED_KEY = 'tg_closed_windows';

/**
 * Persists a window snapshot.
 * If a snapshot with the same windowId already exists it is replaced in-place;
 * otherwise the snapshot is appended to the list.
 *
 * @param {{ windowId: number, timestamp: number, tabs: string[] }} snapshot
 * @returns {Promise<void>}
 */
export async function saveSnapshot(snapshot) {
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY]);
  const snapshots = data[SNAPSHOTS_KEY] || [];
  const existingIndex = snapshots.findIndex((s) => s.windowId === snapshot.windowId);
  if (existingIndex >= 0) {
    snapshots[existingIndex] = snapshot;
  } else {
    snapshots.push(snapshot);
  }
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: snapshots });
}

/**
 * Returns all stored window snapshots.
 *
 * @returns {Promise<Array<{ windowId: number, timestamp: number, tabs: string[] }>>}
 */
export async function getSnapshots() {
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY]);
  return data[SNAPSHOTS_KEY] || [];
}

/**
 * Prepends a closed-window snapshot to the closed-windows list.
 * Newest entry is always first.
 *
 * @param {{ windowId: number, timestamp: number, tabs: string[] }} snapshot
 * @returns {Promise<void>}
 */
export async function addClosedWindow(snapshot) {
  const data = await chrome.storage.local.get([CLOSED_KEY]);
  const closed = data[CLOSED_KEY] || [];
  closed.unshift(snapshot);
  await chrome.storage.local.set({ [CLOSED_KEY]: closed });
}

/**
 * Returns all stored closed-window snapshots (newest first).
 *
 * @returns {Promise<Array<{ windowId: number, timestamp: number, tabs: string[] }>>}
 */
export async function getClosedWindows() {
  const data = await chrome.storage.local.get([CLOSED_KEY]);
  return data[CLOSED_KEY] || [];
}

/**
 * Removes snapshots and closed-window entries older than maxDays days.
 *
 * @param {number} maxDays
 * @returns {Promise<void>}
 */
export async function removeOldSnapshots(maxDays) {
  const cutoff = Date.now() - maxDays * 24 * 60 * 60 * 1000;
  const data = await chrome.storage.local.get([SNAPSHOTS_KEY, CLOSED_KEY]);
  const snapshots = (data[SNAPSHOTS_KEY] || []).filter((s) => s.timestamp >= cutoff);
  const closed = (data[CLOSED_KEY] || []).filter((s) => s.timestamp >= cutoff);
  await chrome.storage.local.set({ [SNAPSHOTS_KEY]: snapshots, [CLOSED_KEY]: closed });
}

/**
 * Returns the approximate number of bytes currently used by this extension's
 * local storage.
 *
 * @returns {Promise<number>}
 */
export async function getStorageUsage() {
  const bytes = await chrome.storage.local.getBytesInUse();
  return bytes;
}
