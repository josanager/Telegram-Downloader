// content.js – Misil v2.2.2 (Bridge with strict auth check)

const extId = chrome.runtime.id;
console.log(`[Misil] v2.2.2 Bridge Loaded (${extId})`);

// Inject script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// ── Page → Background ──
window.addEventListener(`TelDownloadEvent_${extId}`, async (e) => {
  const { action, data } = e.detail;

  // User clicked Misil icon on media → check auth FIRST
  if (action === 'add-to-panel') {
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) {
      // Not logged in → open side panel to login, DON'T proceed with download
      chrome.runtime.sendMessage({ action: 'open-sidepanel' });
      return; // Stops here — no download triggered
    }
    // Logged in → forward to side panel + open it
    chrome.runtime.sendMessage({ type: 'media-added', data }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'open-sidepanel' });
    return;
  }

  // All relay and panel-download events
  if (action && (action.startsWith('relay-') || action.startsWith('panel-download'))) {
    chrome.runtime.sendMessage({ action: action.startsWith('relay-') ? action : undefined, type: action.startsWith('panel-') ? action : undefined, data }).catch(() => {});
    return;
  }
});

// ── Background → Page ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'trigger-panel-download') {
    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
      detail: { action: 'trigger-panel-download', data: message.data }
    }));
  }
});
