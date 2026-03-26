// background.js – Misil v2.2.2 (Reliable Quota + Relay)

const SUPABASE_URL = "https://cqgpbmxcavdvcvcoojyi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZ3BibXhjYXZkdmN2Y29vanlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODM5NjYsImV4cCI6MjA4OTA1OTk2Nn0.yLz5CnPJW8w7aOarAYDPyB_dYInyB9gKNpBwLpWOoqg";

async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Assemble video blobs from page fragments.'
  });
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Open side panel
  if (message.action === 'open-sidepanel') {
    if (sender.tab && sender.tab.id) {
      chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
    }
    return;
  }

  // Relay chunks to offscreen
  if (message.action && message.action.startsWith('relay-')) {
    if (message.action === 'relay-start') {
      checkQuota(sender.tab ? sender.tab.id : null).then((canDownload) => {
        if (canDownload) {
          setupOffscreen().then(() => {
            chrome.runtime.sendMessage({ type: message.action, data: message.data });
          });
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: message.action, data: message.data }).catch(() => {});
    }
    return;
  }

  // Forward per-item download progress to side panel
  const PANEL_EVENTS = ['panel-download-start', 'panel-download-size', 'panel-download-progress', 'panel-download-done', 'panel-download-error'];
  if (PANEL_EVENTS.includes(message.type)) {
    chrome.runtime.sendMessage({ type: message.type, data: message.data }).catch(() => {});
    return;
  }

  // Download complete from offscreen → save file via chrome.downloads
  if (message.type === 'download-complete') {
    chrome.downloads.download({
      url: message.data.blobUrl,
      filename: message.data.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (id) => {
      if (chrome.runtime.lastError) {
        queryAndRelay({ type: 'download-error', data: { error: chrome.runtime.lastError.message } });
      }
    });
  }

  // Relay progress/error to page
  if (message.type === 'download-progress' || message.type === 'download-error') {
    queryAndRelay(message);
  }

  // Get real-time count from Supabase
  if (message.type === 'get-quota') {
    getQuotaFromSupabase().then(count => {
      sendResponse({ count });
    }).catch(() => sendResponse({ count: 0 }));
    return true;
  }
});

async function queryAndRelay(message) {
  const tabs = await chrome.tabs.query({ url: "*://web.telegram.org/*" });
  tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}));
}

// --- QUOTA: Always reads from Supabase (source of truth) ---
async function getQuotaFromSupabase() {
  const { sb_session } = await chrome.storage.local.get(['sb_session']);
  if (!sb_session) return 0;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${sb_session.user.id}&select=download_count`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sb_session.access_token}`
      }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const count = data.length > 0 ? (data[0].download_count || 0) : 0;
    // Keep local cache in sync
    await chrome.storage.local.set({ download_count: count });
    return count;
  } catch {
    // Fallback to local cache
    const { download_count = 0 } = await chrome.storage.local.get(['download_count']);
    return download_count;
  }
}

async function checkQuota(tabId) {
  const { sb_session } = await chrome.storage.local.get(['sb_session']);
  if (!sb_session) {
    if (tabId) chrome.sidePanel.open({ tabId }).catch(() => {});
    return false;
  }

  const count = await getQuotaFromSupabase();
  if (count >= 100) {
    queryAndRelay({ type: 'download-error', data: { error: 'Límite (100) alcanzado. Pásate a Premium.' } });
    return false;
  }

  // Increment in Supabase
  const newCount = count + 1;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${sb_session.user.id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sb_session.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ download_count: newCount })
    });
  } catch (e) { console.error("Sync error:", e); }

  await chrome.storage.local.set({ download_count: newCount });
  chrome.runtime.sendMessage({ type: 'quota-update', count: newCount }).catch(() => {});
  return true;
}
