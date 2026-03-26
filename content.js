// content.js – Misil v3.0

const extId = chrome.runtime.id;
console.log('[Misil] v3.0 Bridge');

// Inject the page-context script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Listen for download requests from inject.js and forward to background
window.addEventListener('MisilDownload_' + extId, (e) => {
    const { blobUrl, filename } = e.detail;
    // Fetch the blob from the page-context blob URL and re-create in content script context
    fetch(blobUrl)
        .then(r => r.blob())
        .then(blob => {
            const newBlobUrl = URL.createObjectURL(blob);
            chrome.runtime.sendMessage({
                action: 'download-blob',
                blobUrl: newBlobUrl,
                filename: filename
            });
        })
        .catch(err => console.error('[Misil] Bridge error:', err));
});
