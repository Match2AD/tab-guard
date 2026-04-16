import { getClosedWindows } from '../storage.js';
import { formatRelativeTime } from '../utils.js';
import { el, favicon, clearChildren } from '../dom.js';
import { restoreWindow, restoreAllWindows, GROUP_COLORS } from '../restore.js';

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

// --- Settings Link ---

document.getElementById('settings-link').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('src/settings/settings.html') });
});

// --- Group Helpers ---

/**
 * Builds group badge elements for the window header.
 * @param {Array} groups
 * @returns {HTMLElement}
 */
function renderGroupBadges(groups) {
  const container = el('div', { className: 'group-badges' });
  for (const group of groups) {
    const color = GROUP_COLORS[group.color] || '#5f6368';
    const badge = el('span', {
      className: 'group-badge',
      textContent: group.title || 'Gruppe',
    });
    badge.style.borderColor = color;
    badge.style.color = color;
    container.appendChild(badge);
  }
  return container;
}

/**
 * Renders tabs organized by groups.
 * Ungrouped tabs appear first, then each group with a colored header.
 * @param {Array} tabs
 * @param {Array} groups
 * @returns {HTMLElement}
 */
function renderGroupedTabs(tabs, groups) {
  const container = el('div', { className: 'grouped-tabs' });
  const groupMap = new Map();

  // Build group lookup
  for (const g of (groups || [])) {
    groupMap.set(g.id, g);
  }

  // Separate ungrouped and grouped tabs
  const ungrouped = tabs.filter((t) => t.groupId == null);
  const groupedByIdMap = new Map();

  for (const tab of tabs) {
    if (tab.groupId != null) {
      if (!groupedByIdMap.has(tab.groupId)) groupedByIdMap.set(tab.groupId, []);
      groupedByIdMap.get(tab.groupId).push(tab);
    }
  }

  // Render ungrouped tabs
  for (const tab of ungrouped) {
    container.appendChild(renderTabItem(tab));
  }

  // Render each group
  for (const [groupId, groupTabs] of groupedByIdMap.entries()) {
    const groupInfo = groupMap.get(groupId);
    const color = GROUP_COLORS[groupInfo?.color] || '#5f6368';
    const title = groupInfo?.title || 'Gruppe';

    const groupHeader = el('div', { className: 'group-header' }, [
      el('span', { className: 'group-dot' }),
      el('span', { className: 'group-name', textContent: `${title} (${groupTabs.length})` }),
    ]);
    groupHeader.querySelector('.group-dot').style.background = color;
    groupHeader.querySelector('.group-name').style.color = color;

    const groupSection = el('div', { className: 'group-section' });
    groupSection.style.borderLeftColor = color;

    groupSection.appendChild(groupHeader);
    for (const tab of groupTabs) {
      groupSection.appendChild(renderTabItem(tab));
    }

    container.appendChild(groupSection);
  }

  return container;
}

/**
 * Renders a single tab item.
 * @param {{ url: string, title: string, favIconUrl: string }} tab
 * @returns {HTMLElement}
 */
function renderTabItem(tab) {
  return el('div', {
    className: 'tab-item',
    onClick: () => chrome.tabs.create({ url: tab.url }),
  }, [
    favicon(tab.favIconUrl),
    el('span', { className: 'tab-title', textContent: tab.title || tab.url }),
  ]);
}

// --- Render Window Card ---

function renderWindowCard(snapshot, isExpanded) {
  const toggleChar = isExpanded ? '\u25BE' : '\u25B8';
  const hasGroups = snapshot.groups && snapshot.groups.length > 0;
  const groupCount = hasGroups ? snapshot.groups.length : 0;

  const toggleSpan = el('span', { className: 'window-toggle', textContent: toggleChar });

  const titleText = groupCount > 0
    ? ` Fenster \u2014 ${snapshot.tabs.length} Tabs, ${groupCount} Gruppe${groupCount > 1 ? 'n' : ''}`
    : ` Fenster \u2014 ${snapshot.tabs.length} Tabs`;

  const titleSpan = el('span', { className: 'window-title' }, [toggleSpan, titleText]);

  const headerChildren = [titleSpan];
  if (hasGroups) {
    headerChildren.push(renderGroupBadges(snapshot.groups));
  }

  const header = el('div', { className: 'window-header' }, headerChildren);

  const tabItems = el('div', { className: `tab-items${isExpanded ? ' expanded' : ''}` });
  const groupedContent = renderGroupedTabs(snapshot.tabs, snapshot.groups || []);
  tabItems.appendChild(groupedContent);

  header.addEventListener('click', () => {
    const expanded = tabItems.classList.toggle('expanded');
    toggleSpan.textContent = expanded ? '\u25BE' : '\u25B8';
  });

  return el('div', { className: 'window-card' }, [header, tabItems]);
}

// --- Render Active Windows (with group info) ---

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
  const noGroup = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;

  for (const win of trackable) {
    // Query tab groups for this window
    let groups = [];
    try {
      const tabGroups = await chrome.tabGroups.query({ windowId: win.id });
      groups = tabGroups.map((g) => ({
        id: g.id,
        title: g.title || '',
        color: g.color,
        collapsed: g.collapsed,
      }));
    } catch (_) {
      // tabGroups API unavailable
    }

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
        groupId: t.groupId != null && t.groupId !== noGroup ? t.groupId : null,
      })),
      groups,
    };
    container.appendChild(renderWindowCard(snapshot, win.id === focusedWin.id));
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
      const hasGroups = snap.groups && snap.groups.length > 0;
      const groupNames = hasGroups
        ? snap.groups.map((g) => g.title || 'Gruppe').join(', ')
        : '';
      const preview = groupNames || snap.tabs.slice(0, 3).map((t) => t.title || t.url).join(', ');

      const btn = el('button', {
        className: 'btn-restore',
        textContent: 'Wiederherstellen',
        onClick: () => restoreWindow(snap),
      });

      const infoChildren = [
        el('span', { className: 'closed-title', textContent: `Fenster mit ${snap.tabs.length} Tabs` }),
        el('span', { className: 'closed-time', textContent: `${formatRelativeTime(snap.timestamp)} \u2022 ${preview}` }),
      ];

      // Show group badges in closed window cards
      if (hasGroups) {
        infoChildren.push(renderGroupBadges(snap.groups));
      }

      const card = el('div', { className: 'closed-window-card' }, [
        el('div', { className: 'closed-header' }, [
          el('div', { className: 'closed-info' }, infoChildren),
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
  const totalGroups = closed.reduce((sum, s) => sum + (s.groups?.length || 0), 0);

  const parts = [`${closed.length} Fenster`, `${totalTabs} Tabs`];
  if (totalGroups > 0) parts.push(`${totalGroups} Gruppe${totalGroups > 1 ? 'n' : ''}`);
  detail.textContent = parts.join(', ');

  banner.classList.remove('hidden');

  restoreBtn.addEventListener('click', () => {
    restoreAllWindows(closed);
  });
}

// --- Init ---

loadActiveWindows();
loadClosedWindows();
loadRestoreBanner();
