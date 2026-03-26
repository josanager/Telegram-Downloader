// background.js – Misil v3.0

// Open side panel when user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// Listen for download requests from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'download-blob') {
    chrome.downloads.download({
      url: message.blobUrl,
      filename: message.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[Misil BG] Download error:', chrome.runtime.lastError.message);
      }
    });
  }
});
