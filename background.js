// background.js (v17.0 - Robust Orchestrator)

let pendingDownload = null;

async function setupOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Bypass Service Worker for large media downloads.'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. From Page
  if (message.action === 'download_bg') {
    const downloadId = Date.now().toString();
    pendingDownload = {
      type: 'start-download',
      data: { ...message, downloadId }
    };

    setupOffscreen().catch(err => {
      console.error("Offscreen creation failed:", err);
      queryAndRelay({
        type: 'download-error',
        data: { downloadId, error: "No se pudo iniciar el motor" }
      });
    });

    // If offscreen already exists, it might not send 'offscreen-ready'
    // So we also attempt to send immediately if contexts exist
    chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] }).then(ctx => {
      if (ctx.length > 0 && pendingDownload) {
        chrome.runtime.sendMessage(pendingDownload);
        pendingDownload = null;
      }
    });

    sendResponse({ success: true });
    return true;
  }

  // 2. From Offscreen Readiness
  if (message.type === 'offscreen-ready') {
    if (pendingDownload) {
      chrome.runtime.sendMessage(pendingDownload);
      pendingDownload = null;
    }
  }

  // 3. From Offscreen Progress
  if (message.type === 'download-progress' || message.type === 'download-error') {
    queryAndRelay(message);
  }

  // 4. From Offscreen Complete
  if (message.type === 'download-complete') {
    const { blobUrl, filename, downloadId } = message.data;
    chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: false
    }, () => {
      queryAndRelay({
        type: 'download-progress',
        data: { downloadId, percent: 100, status: '¡Completado!' }
      });
    });
  }
});

async function queryAndRelay(message) {
  const tabs = await chrome.tabs.query({ url: "*://web.telegram.org/*" });
  tabs.forEach(tab => {
    chrome.tabs.sendMessage(tab.id, message).catch(() => { });
  });
}

// Keep Service Worker Alive
setInterval(() => {
  console.log("[Background] Keep-alive ping");
}, 20000);
