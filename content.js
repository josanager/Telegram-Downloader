// content.js – Misil v3.1

const extId = chrome.runtime.id;
console.log('[Misil] v3.1 Bridge');

// Inject the page-context script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Listen for download requests from inject.js via postMessage
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'MISIL_DOWNLOAD') return;

    const { dataUrl, filename } = event.data;
    console.log('[Misil Bridge] Received download request:', filename);

    // Send dataURL to background for chrome.downloads
    chrome.runtime.sendMessage({
        action: 'download-data',
        dataUrl: dataUrl,
        filename: filename
    }).catch(err => console.error('[Misil Bridge] Send error:', err));
});
