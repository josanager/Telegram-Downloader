// background.js (v21.0 - Relay Orchestrator)

async function setupOffscreen() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length > 0) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Assemble video blobs from page fragments.'
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action && message.action.startsWith('relay-')) {
    // Ensure offscreen is ready before relaying first chunk
    if (message.action === 'relay-start') {
      setupOffscreen().then(() => {
        chrome.runtime.sendMessage({ type: message.action, data: message.data });
      });
    } else {
      // Just pass through to offscreen
      chrome.runtime.sendMessage({ type: message.action, data: message.data }).catch(() => { });
    }
    return;
  }

  // Handle results from Offscreen
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
      }
    });
  }

  if (message.type === 'download-progress' || message.type === 'download-error') {
    queryAndRelay(message);
  }
});

async function queryAndRelay(message) {
  const tabs = await chrome.tabs.query({ url: "*://web.telegram.org/*" });
  tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => { }));
}

setInterval(() => { }, 25000);
