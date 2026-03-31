import { getClosedWindows } from '../storage.js';
import { formatRelativeTime } from '../utils.js';
import { el, favicon, clearChildren } from '../dom.js';

// --- Tab Navigation ---

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;
    tabBtns.forEach((b) => b.classList.remove('active'));
    tabContents.forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

// --- Dashboard Links ---

function openDashboard() {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/dashboard/dashboard.html') });
}

document.getElementById('dashboard-link').addEventListener('click', openDashboard);
document.getElementById('open-dashboard').addEventListener('click', openDashboard);

// --- Render Active Windows ---

function renderWindowCard(snapshot, isExpanded) {
  const toggleChar = isExpanded ? '\u25BE' : '\u25B8';

  const toggleSpan = el('span', { className: 'window-toggle', textContent: toggleChar });
  const titleSpan = el('span', { className: 'window-title' }, [
    toggleSpan,
    ` Fenster \u2014 ${snapshot.tabs.length} Tabs`,
  ]);
  const badgeSpan = el('span', { className: 'window-badge' });
  const header = el('div', { className: 'window-header' }, [titleSpan, badgeSpan]);

  const tabItems = el('div', { className: `tab-items${isExpanded ? ' expanded' : ''}` });

  for (const tab of snapshot.tabs) {
    const item = el('div', { className: 'tab-item', onClick: () => chrome.tabs.create({ url: tab.url }) }, [
      favicon(tab.favIconUrl),
      el('span', { className: 'tab-title', textContent: tab.title || tab.url }),
    ]);
    tabItems.appendChild(item);
  }

  header.addEventListener('click', () => {
    const expanded = tabItems.classList.toggle('expanded');
    toggleSpan.textContent = expanded ? '\u25BE' : '\u25B8';
  });

  return el('div', { className: 'window-card' }, [header, tabItems]);
}

async function loadActiveWindows() {
  const container = document.getElementById('active-windows');
  clearChildren(container);

  const windows = await chrome.windows.getAll({ populate: true });
  const trackable = windows.filter((w) => w.type === 'normal' && !w.incognito);

  if (trackable.length === 0) {
    container.appendChild(el('p', { className: 'empty-state', textContent: 'Keine Fenster offen.' }));
    return;
  }

  const focusedWin = await chrome.windows.getLastFocused();

  for (const win of trackable) {
    const snapshot = {
      id: '',
      windowId: win.id,
      timestamp: Date.now(),
      tabs: win.tabs.map((t) => ({
        url: t.url || '',
        title: t.title || '',
        favIconUrl: t.favIconUrl || '',
        index: t.index,
        pinned: t.pinned,
      })),
    };
    container.appendChild(renderWindowCard(snapshot, win.id === focusedWin.id));
  }
}

// --- Window Restore with Groups ---

/**
 * Creates a new window from a snapshot and recreates its tab groups.
 * @param {{ tabs: Array, groups: Array }} snap
 */
async function restoreWindowWithGroups(snap) {
  const newWin = await chrome.windows.create({ url: snap.tabs.map((t) => t.url) });

  if (!snap.groups || snap.groups.length === 0) return;

  // Build map: original groupId -> tab indices within this snapshot
  const groupTabIndices = new Map();
  snap.tabs.forEach((tab, i) => {
    if (tab.groupId !== null && tab.groupId !== undefined) {
      if (!groupTabIndices.has(tab.groupId)) groupTabIndices.set(tab.groupId, []);
      groupTabIndices.get(tab.groupId).push(i);
    }
  });

  for (const [origGroupId, indices] of groupTabIndices.entries()) {
    const groupInfo = snap.groups.find((g) => g.id === origGroupId);
    if (!groupInfo) continue;

    const tabIds = indices.map((i) => newWin.tabs?.[i]?.id).filter(Boolean);
    if (tabIds.length === 0) continue;

    const newGroupId = await chrome.tabs.group({ tabIds });
    await chrome.tabGroups.update(newGroupId, {
      title: groupInfo.title || '',
      color: groupInfo.color,
      collapsed: groupInfo.collapsed,
    });
  }
}

// --- Render Closed Windows ---

async function loadClosedWindows() {
  const windowContainer = document.getElementById('closed-windows');
  const tabContainer = document.getElementById('closed-tabs');
  clearChildren(windowContainer);
  clearChildren(tabContainer);

  const closed = await getClosedWindows();

  if (closed.length === 0) {
    windowContainer.appendChild(
      el('p', { className: 'empty-state', textContent: 'Keine geschlossenen Fenster.' })
    );
    return;
  }

  for (const snap of closed) {
    if (snap.tabs.length > 1) {
      const preview = snap.tabs.slice(0, 3).map((t) => t.title || t.url).join(', ');

      const btn = el('button', {
        className: 'btn-restore',
        textContent: 'Wiederherstellen',
        onClick: () => restoreWindowWithGroups(snap),
      });

      const card = el('div', { className: 'closed-window-card' }, [
        el('div', { className: 'closed-header' }, [
          el('div', { className: 'closed-info' }, [
            el('span', { className: 'closed-title', textContent: `Fenster mit ${snap.tabs.length} Tabs` }),
            el('span', { className: 'closed-time', textContent: `${formatRelativeTime(snap.timestamp)} \u2022 ${preview}\u2026` }),
          ]),
          btn,
        ]),
      ]);

      windowContainer.appendChild(card);
    } else if (snap.tabs.length === 1) {
      const tab = snap.tabs[0];
      const item = el('div', { className: 'closed-tab-item' }, [
        favicon(tab.favIconUrl),
        el('span', { className: 'tab-title', textContent: tab.title || tab.url }),
        el('span', { className: 'closed-tab-time', textContent: formatRelativeTime(snap.timestamp) }),
        el('button', {
          className: 'closed-tab-open',
          textContent: '\u00D6ffnen',
          onClick: () => chrome.tabs.create({ url: tab.url }),
        }),
      ]);
      tabContainer.appendChild(item);
    }
  }
}

// --- Restore Banner ---

async function loadRestoreBanner() {
  const closed = await getClosedWindows();
  const banner = document.getElementById('restore-banner');
  const detail = document.getElementById('restore-detail');
  const restoreBtn = document.getElementById('restore-all-btn');

  if (closed.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  const totalTabs = closed.reduce((sum, s) => sum + s.tabs.length, 0);
  detail.textContent = `${closed.length} Fenster, ${totalTabs} Tabs`;
  banner.classList.remove('hidden');

  restoreBtn.addEventListener('click', () => {
    for (const snap of closed) {
      restoreWindowWithGroups(snap);
    }
  });
}

// --- Init ---

loadActiveWindows();
loadClosedWindows();
loadRestoreBanner();
