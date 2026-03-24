// background.js – Misil v2.0 (Relay Orchestrator)

async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Assemble video blobs from page fragments.'
  });
}

// Open side panel when user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action && message.action.startsWith('relay-')) {
    if (message.action === 'relay-start') {
      checkQuota().then((canDownload) => {
        if (canDownload) {
          setupOffscreen().then(() => {
            chrome.runtime.sendMessage({ type: message.action, data: message.data });
          });
        } else {
          queryAndRelay({ type: 'download-error', data: { error: 'Límite de descargas alcanzado (100/mes).' } });
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: message.action, data: message.data }).catch(() => {});
    }
    return;
  }

  // Download complete from offscreen
  if (message.type === 'download-complete') {
    chrome.downloads.download({
      url: message.data.blobUrl,
      filename: message.data.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (id) => {
      if (chrome.runtime.lastError) {
        queryAndRelay({ type: 'download-error', data: { error: chrome.runtime.lastError.message } });
      } else {
        queryAndRelay({ type: 'download-progress', data: { percent: 100, status: '¡Listo!' } });
        saveToHistory(message.data.filename);
      }
    });
  }

  // Relay progress/error back to page
  if (message.type === 'download-progress' || message.type === 'download-error') {
    queryAndRelay(message);
  }

  // Side panel requests history
  if (message.type === 'get-history') {
    chrome.storage.local.get(['download_history'], (result) => {
      sendResponse(result.download_history || []);
    });
    return true; // keep channel open for async sendResponse
  }
});

async function queryAndRelay(message) {
  const tabs = await chrome.tabs.query({ url: "*://web.telegram.org/*" });
  tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}));
}

// --- QUOTA (Local) ---
async function checkQuota() {
  const { download_count = 0 } = await chrome.storage.local.get(['download_count']);
  if (download_count >= 100) return false;
  await chrome.storage.local.set({ download_count: download_count + 1 });
  chrome.runtime.sendMessage({ type: 'quota-update', count: download_count + 1, limit: 100 }).catch(() => {});
  return true;
}

// --- DOWNLOAD HISTORY ---
async function saveToHistory(filename) {
  const { download_history = [] } = await chrome.storage.local.get(['download_history']);
  download_history.unshift({
    name: filename,
    date: new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  });
  // Keep last 50 entries
  if (download_history.length > 50) download_history.length = 50;
  await chrome.storage.local.set({ download_history });
  // Notify side panel
  chrome.runtime.sendMessage({ type: 'history-updated', history: download_history }).catch(() => {});
}
