// content.js – Misil v2.1 (Data Bridge)

const extId = chrome.runtime.id;
console.log(`[Misil] v2.1 Bridge Loaded (${extId})`);

// Inject script with extension ID and icon URL
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/logo.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Relay: Page → Background
window.addEventListener(`TelDownloadEvent_${extId}`, async (e) => {
  const { action, data } = e.detail;

  // User clicked Misil icon on a media → add to panel
  if (action === 'add-to-panel') {
    // Check if user is logged in
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) {
      // Not logged in → open side panel
      chrome.runtime.sendMessage({ action: 'open-sidepanel' });
      return;
    }
    // Logged in → forward to side panel
    chrome.runtime.sendMessage({ type: 'media-added', data }).catch(() => {});
    // Also open side panel so user sees it appear
    chrome.runtime.sendMessage({ action: 'open-sidepanel' });
    return;
  }

  // All relay actions (relay-start, relay-chunk, relay-end, relay-error)
  chrome.runtime.sendMessage({ action, data }).catch(() => {});
});

// Relay: Background → Page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent(`TelExtensionProgress_${extId}`, {
      detail: message
    }));
  }
  // Panel requested download for a specific media → tell inject.js
  if (message.type === 'trigger-panel-download') {
    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
      detail: { action: 'trigger-panel-download', data: message.data }
    }));
  }
});
