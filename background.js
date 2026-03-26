// background.js – Misil v2.3.0 (Relay Only + Quota)

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

  if (message.action === 'open-sidepanel') {
    if (sender.tab && sender.tab.id) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
    return;
  }

  // Relay chunks from page-context fetch → offscreen blob assembler
  if (message.action && message.action.startsWith('relay-')) {
    if (message.action === 'relay-start') {
      // Check quota before allowing offscreen to be set up
      checkQuota(sender.tab ? sender.tab.id : null).then((canDownload) => {
        if (canDownload) {
          setupOffscreen().then(() => {
            chrome.runtime.sendMessage({ type: 'relay-start', data: message.data }).catch(() => {});
          });
        } else {
          // Quota exceeded or not logged in — send error to panel
          if (message.data && message.data.thumbId) {
            chrome.runtime.sendMessage({ type: 'panel-download-error', data: { thumbId: message.data.thumbId, error: 'Sin descargas disponibles o no has iniciado sesión.' } }).catch(() => {});
          }
        }
      });
    } else {
      chrome.runtime.sendMessage({ type: message.action, data: message.data }).catch(() => {});
    }
    return;
  }

  // Forward per-item download progress events to side panel
  const PANEL_EVENTS = ['panel-download-start', 'panel-download-size', 'panel-download-progress', 'panel-download-done', 'panel-download-error'];
  if (PANEL_EVENTS.includes(message.type)) {
    chrome.runtime.sendMessage({ type: message.type, data: message.data }).catch(() => {});
    return;
  }

  // Offscreen blob assembled → trigger browser download
  if (message.type === 'download-complete') {
    chrome.downloads.download({
      url: message.data.blobUrl,
      filename: message.data.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (dlId) => {
      if (chrome.runtime.lastError) {
        console.error('[Misil BG] Download failed:', chrome.runtime.lastError.message);
      }
    });
  }
});

// --- QUOTA ---
async function getQuotaFromSupabase() {
  const { sb_session } = await chrome.storage.local.get(['sb_session']);
  if (!sb_session) return null; // null = not logged in

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${sb_session.user.id}&select=download_count`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${sb_session.access_token}`
      }
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.length > 0 ? (data[0].download_count || 0) : 0;
  } catch {
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
  if (count === null) return false;
  if (count >= 100) {
    chrome.runtime.sendMessage({ type: 'panel-download-error', data: { error: 'Límite (100) alcanzado. Pásate a Premium.' } }).catch(() => {});
    return false;
  }

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
  } catch {}

  await chrome.storage.local.set({ download_count: newCount });
  chrome.runtime.sendMessage({ type: 'quota-update', count: newCount }).catch(() => {});
  return true;
}
