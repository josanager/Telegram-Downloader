// content.js (v22.1 - Data Bridge with Namespacing)

const extId = chrome.runtime.id;
console.log(`[Tel Download] v22.1 Bridge Loaded (${extId})`);

// Inject script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId; // Pass extension ID to inject.js
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Relay Page -> Background
window.addEventListener(`TelDownloadEvent_${extId}`, (e) => {
  const { action, data } = e.detail;
  chrome.runtime.sendMessage({ action, data }).catch(() => { });
});

// Relay Background -> Page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent(`TelExtensionProgress_${extId}`, {
      detail: message
    }));
  }
});
