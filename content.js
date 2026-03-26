// content.js — Misil v4.0 (Secure validated bridge)
// Runs in ISOLATED world. Validates all messages with nonce + origin + shape.

const EXPECTED_ORIGIN = 'https://web.telegram.org';
const CHANNEL = 'misil';
const nonce = crypto.randomUUID();

// ── Inject MAIN world script with nonce and icon URL ──
const s = document.createElement('script');
s.src = chrome.runtime.getURL('inject.js');
s.dataset.nonce = nonce;
s.dataset.iconUrl = chrome.runtime.getURL('icons/miniatura.svg');
s.onload = () => s.remove();
(document.head || document.documentElement).appendChild(s);

// ── Allowed actions from inject.js ──
const ALLOWED = new Set(['consume-credit', 'refund-credit', 'open-login']);

// ── Validated message handler ──
window.addEventListener('message', async (e) => {
    if (e.source !== window) return;
    if (e.origin !== EXPECTED_ORIGIN) return;
    const m = e.data;
    if (!m || typeof m !== 'object') return;
    if (m.channel !== CHANNEL || m.nonce !== nonce) return;
    if (!ALLOWED.has(m.action)) return;

    if (m.action === 'open-login') {
        chrome.runtime.sendMessage({ action: 'open-sidepanel' }).catch(() => {});
        return;
    }

    if (m.action === 'refund-credit') {
        chrome.runtime.sendMessage({ action: 'refund-credit' }).catch(() => {});
        return;
    }

    if (m.action === 'consume-credit') {
        try {
            const resp = await chrome.runtime.sendMessage({ action: 'consume-credit' });
            reply('consume-result', resp);
        } catch {
            reply('consume-result', { allowed: false, error: 'extension_error' });
        }
    }
});

function reply(action, data) {
    window.postMessage({ channel: CHANNEL, nonce, action, data }, EXPECTED_ORIGIN);
}
