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

// Relay Page → Background
window.addEventListener(`TelDownloadEvent_${extId}`, async (e) => {
  const { action, data } = e.detail;

  if (action === 'user-icon-click') {
    // Check auth state before allowing any download
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    if (!sb_session) {
      // Not logged in: open the side panel and abort download
      chrome.runtime.sendMessage({ action: 'open-sidepanel' });
      // Signal inject.js to cancel pending download
      window.dispatchEvent(new CustomEvent(`TelExtensionProgress_${extId}`, {
        detail: { type: 'auth-required' }
      }));
    }
    // If authed, inject.js proceeds normally with pendingDownload flag
    return;
  }

  // All other actions (relay-start, relay-chunk, relay-end, relay-error)
  chrome.runtime.sendMessage({ action, data }).catch(() => {});
});

// Relay Background → Page (progress, errors)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent(`TelExtensionProgress_${extId}`, {
      detail: message
    }));
  }
});
