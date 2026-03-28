// supabase-client.js — Misil v4.0 (Lightweight REST wrapper, anon key only)

const SUPABASE_URL = 'https://cqgpbmxcavdvcvcoojyi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZ3BibXhjYXZkdmN2Y29vanlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODM5NjYsImV4cCI6MjA4OTA1OTk2Nn0.yLz5CnPJW8w7aOarAYDPyB_dYInyB9gKNpBwLpWOoqg';

const baseHeaders = { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };

class SupabaseClient {
    // ── Session management ──
    static async getSession() {
        return new Promise(ok => chrome.storage.local.get(['sb_session'], r => ok(r.sb_session || null)));
    }

    static async setSession(data) {
        await chrome.storage.local.set({ sb_session: data });
    }

    // ── Auth ──
    static async signUp(email, password) {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST', headers: baseHeaders,
            body: JSON.stringify({ email, password })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.msg || d.message || d.error_description || d.error || 'Error de registro');
        if (d.session) {
            await this.setSession(d.session);
            await this.ensureProfile(d.user.id, email);
        } else if (d.user && !d.session) {
            throw new Error('Confirma tu correo antes de ingresar.');
        }
        return d;
    }

    static async signIn(email, password) {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST', headers: baseHeaders,
            body: JSON.stringify({ email, password })
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error_description || d.msg || d.message || d.error || 'Credenciales inválidas');
        await this.setSession(d);
        await this.ensureProfile(d.user.id, email);
        return d;
    }

    static async signOut() {
        await chrome.storage.local.remove(['sb_session', 'download_count']);
    }

    // ── Profile ──
    static async getProfile() {
        const s = await this.getSession();
        if (!s) return null;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.user.id}&select=*`, {
            headers: { ...baseHeaders, 'Authorization': `Bearer ${s.access_token}` }
        });
        if (!r.ok) return null;
        const rows = await r.json();
        return rows.length > 0 ? rows[0] : null;
    }

    static async updateAuthUser(payload) {
        const s = await this.getSession();
        if (!s) throw new Error('No active session');
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            method: 'PUT',
            headers: { ...baseHeaders, 'Authorization': `Bearer ${s.access_token}` },
            body: JSON.stringify(payload)
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.msg || d.message || d.error_description || d.error || 'Update failed');
        return d;
    }

    static async updateUsername(newUsername) {
        const s = await this.getSession();
        if (!s?.user?.id) throw new Error('No active session');
        const safe = String(newUsername || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!safe) throw new Error('Usuario inválido');
        const nextEmail = `${safe}@misil.app`;
        await this.updateAuthUser({ email: nextEmail });
        await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.user.id}`, {
            method: 'PATCH',
            headers: { ...baseHeaders, 'Authorization': `Bearer ${s.access_token}` },
            body: JSON.stringify({ email: nextEmail })
        }).catch(() => {});
        const nextSession = { ...s, user: { ...s.user, email: nextEmail } };
        await this.setSession(nextSession);
        return nextEmail;
    }

    static async updatePassword(newPassword) {
        if (!newPassword || newPassword.length < 6) throw new Error('Mínimo 6 caracteres.');
        await this.updateAuthUser({ password: newPassword });
    }

    static async updatePlan(plan) {
        const s = await this.getSession();
        if (!s?.user?.id) throw new Error('No active session');
        const allowed = new Set(['free', 'pro', 'forever']);
        if (!allowed.has(plan)) throw new Error('Invalid plan');
        const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${s.user.id}`, {
            method: 'PATCH',
            headers: { ...baseHeaders, 'Authorization': `Bearer ${s.access_token}` },
            body: JSON.stringify({ plan })
        });
        if (!r.ok) throw new Error('Plan update failed');
    }

    static async ensureProfile(userId, email) {
        const s = await this.getSession();
        if (!s) return;
        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: { ...baseHeaders, 'Authorization': `Bearer ${s.access_token}`, 'Prefer': 'resolution=merge-duplicates' },
            body: JSON.stringify({ id: userId, email, download_count: 0, plan: 'free' })
        }).catch(() => {});
    }
}
