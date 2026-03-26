// background.js – Misil v2.2.3 (Native Downloads + Quota Fix)

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

  // --- NATIVE DIRECT DOWNLOAD (Bypasses CORS) ---
  if (message.action === 'request-direct-download') {
    checkQuota(sender.tab ? sender.tab.id : null).then((canDownload) => {
      if (!canDownload) {
        chrome.runtime.sendMessage({ type: 'panel-download-error', data: { thumbId: message.data.thumbId, error: 'Límite alcanzado' } }).catch(()=>{});
        return;
      }
      
      const { src, filename, thumbId } = message.data;
      
      chrome.downloads.download({
        url: src,
        filename: filename,
        saveAs: false,
        conflictAction: 'uniquify'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          chrome.runtime.sendMessage({ type: 'panel-download-error', data: { thumbId, error: chrome.runtime.lastError.message } }).catch(()=>{});
          return;
        }

        chrome.runtime.sendMessage({ type: 'panel-download-start', data: { thumbId, filename } }).catch(()=>{});

        // Poll progress
        const interval = setInterval(() => {
          chrome.downloads.search({ id: downloadId }, (results) => {
            if (!results || results.length === 0) { clearInterval(interval); return; }
            const item = results[0];
            if (item.state === 'in_progress') {
              if (item.totalBytes && item.totalBytes > 0) {
                 const pct = (item.bytesReceived / item.totalBytes) * 100;
                 chrome.runtime.sendMessage({ type: 'panel-download-progress', data: { thumbId, percent: Math.floor(pct), receivedMb: (item.bytesReceived / 1048576).toFixed(1) } }).catch(()=>{});
                 // Also approximate total size once
                 chrome.runtime.sendMessage({ type: 'panel-download-size', data: { thumbId, totalMb: (item.totalBytes / 1048576).toFixed(1) } }).catch(()=>{});
              }
            } else {
              clearInterval(interval);
            }
          });
        }, 500);

        chrome.downloads.onChanged.addListener(function trackProgress(delta) {
           if (delta.id === downloadId) {
              if (delta.state && delta.state.current === 'complete') {
                  clearInterval(interval);
                  chrome.runtime.sendMessage({ type: 'panel-download-done', data: { thumbId, filename } }).catch(()=>{});
                  chrome.downloads.onChanged.removeListener(trackProgress);
              } else if (delta.state && delta.state.current === 'interrupted') {
                  clearInterval(interval);
                  chrome.runtime.sendMessage({ type: 'panel-download-error', data: { thumbId, error: 'Descarga interrumpida por el navegador.' } }).catch(()=>{});
                  chrome.downloads.onChanged.removeListener(trackProgress);
              }
           }
        });
      });
    });
    return;
  }

  // Relay chunks to offscreen (for blob URLs)
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

  // Download complete from offscreen blob assembler
  if (message.type === 'download-complete') {
    chrome.downloads.download({
      url: message.data.blobUrl,
      filename: message.data.filename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
  }
});

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
    await chrome.storage.local.set({ download_count: count });
    return count;
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
  if (count >= 100) {
    chrome.runtime.sendMessage({ type: 'quota-error', error: 'Límite (100) alcanzado. Pásate a Premium.' }).catch(() => {});
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
  } catch (e) {}

  await chrome.storage.local.set({ download_count: newCount });
  chrome.runtime.sendMessage({ type: 'quota-update', count: newCount }).catch(() => {});
  return true;
}
