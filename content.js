// content.js – Misil v2.2 (Bridge)

const extId = chrome.runtime.id;
console.log(`[Misil] v2.2 Bridge Loaded (${extId})`);

// Inject script with extension ID and the miniatura.svg icon URL
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
// Use miniatura.svg as the in-video button icon
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// ── Page → Background ──
window.addEventListener(`TelDownloadEvent_${extId}`, async (e) => {
  const { action, data } = e.detail;

  // User clicked Misil icon → check auth first
  if (action === 'add-to-panel') {
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) {
      chrome.runtime.sendMessage({ action: 'open-sidepanel' });
      return;
    }
    // Logged in: forward to side panel + open it
    chrome.runtime.sendMessage({ type: 'media-added', data }).catch(() => {});
    chrome.runtime.sendMessage({ action: 'open-sidepanel' });
    return;
  }

  // Panel download progress events → forward to background → forward to sidepanel
  if (action === 'panel-download-start' || action === 'panel-download-size' ||
      action === 'panel-download-progress' || action === 'panel-download-done' ||
      action === 'panel-download-error') {
    chrome.runtime.sendMessage({ type: action, data }).catch(() => {});
    return;
  }

  // Relay chunk actions for offscreen download assembler
  if (action && action.startsWith('relay-')) {
    chrome.runtime.sendMessage({ action, data }).catch(() => {});
  }
});

// ── Background → Page ──
chrome.runtime.onMessage.addListener((message) => {
  // Trigger download from panel download button
  if (message.type === 'trigger-panel-download') {
    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
      detail: { action: 'trigger-panel-download', data: message.data }
    }));
  }
});
