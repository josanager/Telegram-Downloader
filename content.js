// content.js (v17.2 - Bridge)

console.log("[Tel Download] Content Bridge v17.2 Loaded");

// Inject UI
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Relay Page -> Background
window.addEventListener("TelDownloadEvent", (e) => {
  const { action, data } = e.detail;
  if (action === "download") {
    chrome.runtime.sendMessage({
      action: "download_bg",
      url: data.url,
      filename: data.filename
    });
  }
});

// Relay Background -> Page
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'download-progress' || message.type === 'download-error') {
    window.dispatchEvent(new CustomEvent("TelExtensionProgress", {
      detail: message
    }));
  }
});
