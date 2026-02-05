// content.js (v21.0 - Data Bridge)

console.log("[Tel Download] v21.0 Bridge Loaded");

// Inject script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Relay Page -> Background
window.addEventListener("TelDownloadEvent", (e) => {
  const { action, data } = e.detail;
  chrome.runtime.sendMessage({ action, data }).catch(() => { });
});

// Relay Background -> Page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent("TelExtensionProgress", {
      detail: message
    }));
  }
});
