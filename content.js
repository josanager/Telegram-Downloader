// content.js – Misil v2.1 (Data Bridge + Media Scanner)

const extId = chrome.runtime.id;
console.log(`[Misil] v2.1 Bridge Loaded (${extId})`);

// Inject script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Relay Page -> Background (downloads + media detection)
window.addEventListener(`TelDownloadEvent_${extId}`, (e) => {
  const { action, data } = e.detail;
  if (action === 'media-found') {
    // Send detected media directly to the side panel via background
    chrome.runtime.sendMessage({ type: 'media-detected', data }).catch(() => {});
  } else {
    chrome.runtime.sendMessage({ action, data }).catch(() => {});
  }
});

// Relay Background -> Page (progress, errors)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent(`TelExtensionProgress_${extId}`, {
      detail: message
    }));
  }
  // Side panel requested a download of a specific detected video
  if (message.type === 'trigger-download') {
    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
      detail: {
        action: 'trigger-fetch',
        data: message.data
      }
    }));
  }
});
