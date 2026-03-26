// content.js – Misil v2.3.0 (Clean Bridge)

const extId = chrome.runtime.id;
console.log(`[Misil] v2.3.0 Bridge Loaded`);

// Inject the in-page script with extension ID and icon URL
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// ── Page → Background ──
window.addEventListener(`TelDownloadEvent_${extId}`, async (e) => {
  const { action, data } = e.detail || {};
  if (!action) return;

  // Button clicked → check auth first
  if (action === 'add-to-panel') {
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) {
      // Not logged in → open side panel for login only, no download
      chrome.runtime.sendMessage({ action: 'open-sidepanel' });
      return;
    }
    // Logged in → show item in panel + open panel
    chrome.runtime.sendMessage({ type: 'media-added', data }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'open-sidepanel' });
    return;
  }

  // Relay actions: forward to background (which forwards to offscreen)
  if (action.startsWith('relay-')) {
    chrome.runtime.sendMessage({ action, data }).catch(() => {});
    return;
  }

  // Panel progress events from page: forward to background (which forwards to sidepanel)
  if (action.startsWith('panel-download')) {
    chrome.runtime.sendMessage({ type: action, data }).catch(() => {});
    return;
  }
});
