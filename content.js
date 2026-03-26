// content.js – Misil v3.0 (Simple bridge)

const extId = chrome.runtime.id;
console.log('[Misil] v3.0 Bridge');

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.dataset.extId = extId;
script.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);
