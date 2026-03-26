// background.js — Misil v4.0 (Orchestrator: quota + auth only, ZERO binary data)

const SB_URL = 'https://cqgpbmxcavdvcvcoojyi.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZ3BibXhjYXZkdmN2Y29vanlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODM5NjYsImV4cCI6MjA4OTA1OTk2Nn0.yLz5CnPJW8w7aOarAYDPyB_dYInyB9gKNpBwLpWOoqg';

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ── Message Router ──
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    if (msg.action === 'open-sidepanel') {
        if (sender.tab?.id) chrome.sidePanel.open({ tabId: sender.tab.id }).catch(() => {});
        return;
    }
    if (msg.action === 'consume-credit') {
        consumeCredit().then(respond).catch(() => respond({ allowed: false, error: 'unknown' }));
        return true;
    }
    if (msg.action === 'refund-credit') {
        refundCredit().catch(() => {});
        return;
    }
});

// ── Helpers ──
async function getSession() {
    const { sb_session } = await chrome.storage.local.get(['sb_session']);
    return sb_session || null;
}

function authHeaders(token) {
    return {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// ── Consume 1 credit atomically ──
async function consumeCredit() {
    const session = await getSession();
    if (!session) return { allowed: false, error: 'not_authenticated' };

    // Try RPC first (atomic, race-safe)
    try {
        const r = await fetch(`${SB_URL}/rest/v1/rpc/consume_download_credit`, {
            method: 'POST',
            headers: authHeaders(session.access_token),
            body: JSON.stringify({ p_user_id: session.user.id })
        });
        if (r.ok) {
            const result = await r.json();
            await chrome.storage.local.set({ download_count: result.count || 0 });
            return result; // {allowed, remaining, count}
        }
    } catch { /* RPC unavailable, fallback below */ }

    // Fallback: manual check+increment (non-atomic)
    return await manualConsume(session);
}

async function manualConsume(session) {
    try {
        const r = await fetch(
            `${SB_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=download_count,plan`,
            { headers: authHeaders(session.access_token) }
        );
        if (!r.ok) return { allowed: false, error: 'supabase_unavailable' };
        const rows = await r.json();
        if (!rows.length) return { allowed: false, error: 'profile_not_found' };

        const { download_count: count = 0, plan = 'free' } = rows[0];
        const limit = plan === 'premium' ? 1000 : 100;
        if (count >= limit) return { allowed: false, error: 'quota_exceeded', remaining: 0 };

        await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
            method: 'PATCH',
            headers: authHeaders(session.access_token),
            body: JSON.stringify({ download_count: count + 1 })
        });

        const newCount = count + 1;
        await chrome.storage.local.set({ download_count: newCount });
        return { allowed: true, remaining: limit - newCount, count: newCount };
    } catch {
        return { allowed: false, error: 'supabase_unavailable' };
    }
}

async function refundCredit() {
    const session = await getSession();
    if (!session) return;
    try {
        const r = await fetch(`${SB_URL}/rest/v1/rpc/refund_download_credit`, {
            method: 'POST',
            headers: authHeaders(session.access_token),
            body: JSON.stringify({ p_user_id: session.user.id })
        });
        if (!r.ok) {
            // Fallback: manual decrement
            const pr = await fetch(
                `${SB_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=download_count`,
                { headers: authHeaders(session.access_token) }
            );
            if (pr.ok) {
                const rows = await pr.json();
                if (rows.length) {
                    await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
                        method: 'PATCH',
                        headers: authHeaders(session.access_token),
                        body: JSON.stringify({ download_count: Math.max(0, (rows[0].download_count || 1) - 1) })
                    });
                }
            }
        }
    } catch { /* best effort */ }
}
