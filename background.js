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

  // Relay detected media from content script to side panel (no-op if panel closed)
  if (message.type === 'media-detected') {
    // Just let it propagate to side panel via runtime.onMessage
    return;
  }

  // Side panel requests download of a specific detected video
  if (message.type === 'trigger-download') {
    queryAndRelay(message);
    return;
  }
});

async function queryAndRelay(message) {
  const tabs = await chrome.tabs.query({ url: "*://web.telegram.org/*" });
  tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}));
}

// --- QUOTA (Supabase Synced) ---
async function checkQuota() {
  // Check auth state
  const { sb_session } = await chrome.storage.local.get(['sb_session']);
  if (!sb_session) {
      // Prompt user to open side panel
      queryAndRelay({ type: 'download-error', data: { error: '¡Requiere inicio de sesión! Abre la extensión.' } });
      // We can also trigger side panel open directly in Chrome 116+
      return false;
  }

  // Get current local quota (faster UX than blocking fetch)
  const { download_count = 0 } = await chrome.storage.local.get(['download_count']);
  
  // Hard limit check
  if (download_count >= 100) {
      queryAndRelay({ type: 'download-error', data: { error: 'Límite (100) alcanzado. Pásate a Premium.' } });
      return false;
  }
  
  // Optimistic UI Update
  await chrome.storage.local.set({ download_count: download_count + 1 });
  chrome.runtime.sendMessage({ type: 'quota-update', count: download_count + 1, limit: 100 }).catch(() => {});
  
  // Background Sync via fetch (simulate what supabase-client does since we can't import modules easily in MV3 root)
  const SUPABASE_URL = "https://cqgpbmxcavdvcvcoojyi.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZ3BibXhjYXZkdmN2Y29vanlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODM5NjYsImV4cCI6MjA4OTA1OTk2Nn0.yLz5CnPJW8w7aOarAYDPyB_dYInyB9gKNpBwLpWOoqg";
  
  fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${sb_session.user.id}`, {
      method: 'PATCH',
      headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${sb_session.access_token}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify({ download_count: download_count + 1 })
  }).catch(e => console.error("Sync error:", e));

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
