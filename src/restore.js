/**
 * Restore module for Tab Guard.
 * Handles window restoration with tab group recreation and lazy loading.
 *
 * Lazy loading: Tabs are created but not loaded (discarded) until the user
 * clicks on them. This saves memory and CPU when restoring large sessions.
 */

/**
 * Chrome tab group color names mapped to CSS hex values.
 * Used for visual indicators in the UI.
 */
export const GROUP_COLORS = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#188038',
  pink: '#d01884',
  purple: '#a142f4',
  cyan: '#007b83',
  orange: '#fa903e',
};

/**
 * Restores a window from a snapshot with full tab group support and lazy loading.
 *
 * Strategy:
 *  1. Create a new window with the first tab (active, loaded immediately)
 *  2. Create remaining tabs with active: false
 *  3. Wait for Chrome to stabilize tab state
 *  4. Recreate tab groups with original names, colors, and collapsed state
 *  5. Discard all non-active tabs so they don't consume memory
 *
 * @param {{ tabs: Array, groups: Array }} snap - Window snapshot
 * @param {{ lazy: boolean }} options - Restore options
 * @returns {Promise<chrome.windows.Window>}
 */
export async function restoreWindow(snap, { lazy = true } = {}) {
  if (!snap.tabs || snap.tabs.length === 0) return null;

  // 1. Create window with the first tab only
  const firstTab = snap.tabs[0];
  const newWin = await chrome.windows.create({
    url: firstTab.url,
    focused: true,
  });

  const createdTabIds = [newWin.tabs[0].id];

  // 2. Create remaining tabs one by one
  for (let i = 1; i < snap.tabs.length; i++) {
    const tab = snap.tabs[i];
    const created = await chrome.tabs.create({
      windowId: newWin.id,
      url: tab.url,
      active: false,
      pinned: tab.pinned || false,
      index: i,
    });
    createdTabIds.push(created.id);
  }

  // Pin the first tab if it was pinned
  if (firstTab.pinned) {
    await chrome.tabs.update(createdTabIds[0], { pinned: true });
  }

  // 3. Wait for Chrome to fully register all tabs before grouping
  await waitForTabs(createdTabIds);

  // 4. Recreate tab groups
  if (snap.groups && snap.groups.length > 0) {
    await recreateGroups(snap, createdTabIds, newWin.id);
  }

  // 5. Lazy loading: discard all non-active tabs to free memory
  if (lazy) {
    await discardInactiveTabs(createdTabIds);
  }

  return newWin;
}

/**
 * Waits until all tab IDs are queryable by Chrome.
 * This prevents race conditions where chrome.tabs.group() is called
 * before Chrome has finished registering the tab internally.
 *
 * @param {number[]} tabIds
 * @param {number} maxRetries
 */
async function waitForTabs(tabIds, maxRetries = 10) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const tabs = await chrome.tabs.query({ windowId: (await chrome.tabs.get(tabIds[0])).windowId });
      const foundIds = new Set(tabs.map((t) => t.id));
      const allFound = tabIds.every((id) => foundIds.has(id));
      if (allFound) return;
    } catch (_) {
      // Tab not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
}

/**
 * Recreates tab groups from snapshot metadata.
 *
 * @param {{ tabs: Array, groups: Array }} snap
 * @param {number[]} createdTabIds - IDs of the tabs in the new window (same order as snap.tabs)
 * @param {number} windowId - ID of the target window
 */
async function recreateGroups(snap, createdTabIds, windowId) {
  // Map: original groupId -> indices in the snapshot
  const groupTabIndices = new Map();

  for (let i = 0; i < snap.tabs.length; i++) {
    const tab = snap.tabs[i];
    if (tab.groupId != null) {
      if (!groupTabIndices.has(tab.groupId)) {
        groupTabIndices.set(tab.groupId, []);
      }
      groupTabIndices.get(tab.groupId).push(i);
    }
  }

  for (const [origGroupId, indices] of groupTabIndices.entries()) {
    const groupInfo = snap.groups.find((g) => g.id === origGroupId);
    if (!groupInfo) continue;

    const tabIds = indices.map((i) => createdTabIds[i]).filter(Boolean);
    if (tabIds.length === 0) continue;

    try {
      // Explicitly specify the window for group creation
      const newGroupId = await chrome.tabs.group({
        tabIds,
        createProperties: { windowId },
      });

      await chrome.tabGroups.update(newGroupId, {
        title: groupInfo.title || '',
        color: groupInfo.color,
        collapsed: groupInfo.collapsed,
      });
    } catch (err) {
      console.warn('[TabGuard] Gruppe konnte nicht erstellt werden:', groupInfo.title, err);
    }
  }
}

/**
 * Discards tabs that are not active to save memory.
 * Discarded tabs remain in the tab strip but are not loaded until clicked.
 * Group membership is preserved after discard.
 *
 * @param {number[]} tabIds
 */
async function discardInactiveTabs(tabIds) {
  // Wait for groups to stabilize before discarding
  await new Promise((r) => setTimeout(r, 500));

  for (const tabId of tabIds) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab.active) {
        await chrome.tabs.discard(tabId);
      }
    } catch (_) {
      // Tab may have been closed already
    }
  }
}

/**
 * Restores all windows from an array of snapshots.
 *
 * @param {Array} snapshots
 * @param {{ lazy: boolean }} options
 * @returns {Promise<void>}
 */
export async function restoreAllWindows(snapshots, options = { lazy: true }) {
  for (const snap of snapshots) {
    await restoreWindow(snap, options);
  }
}
