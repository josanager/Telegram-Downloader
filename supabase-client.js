// supabase-client.js (Lightweight REST wrapper for extensions)
// Connected to project: cqgpbmxcavdvcvcoojyi (Misil)

const SUPABASE_URL = "https://cqgpbmxcavdvcvcoojyi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxZ3BibXhjYXZkdmN2Y29vanlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0ODM5NjYsImV4cCI6MjA4OTA1OTk2Nn0.yLz5CnPJW8w7aOarAYDPyB_dYInyB9gKNpBwLpWOoqg";

const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
};

class SupabaseClient {
    static async getSession() {
        return new Promise(resolve => {
            chrome.storage.local.get(['sb_session'], result => resolve(result.sb_session));
        });
    }

    static async setSession(sessionData) {
        await chrome.storage.local.set({ 'sb_session': sessionData });
    }

    static async signUp(email, password) {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.msg || data.error_description || "Error de registro");
        
        // If email confirmation is disabled, user is immediately logged in
        if (data.session) {
            await this.setSession(data.session);
            await this.ensureProfile(data.user.id, email);
        }
        return data;
    }

    static async signIn(email, password) {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error_description || "Credenciales incorrectas");
        
        await this.setSession(data);
        await this.ensureProfile(data.user.id, email);
        return data;
    }

    static async signOut() {
        await chrome.storage.local.remove(['sb_session', 'download_count']);
    }

    static async getProfile() {
        const session = await this.getSession();
        if (!session) return null;

        const authHeaders = {
            ...headers,
            'Authorization': `Bearer ${session.access_token}`
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}&select=*`, {
            headers: authHeaders
        });

        if (!response.ok) return null;
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    }

    static async ensureProfile(userId, email) {
        const session = await this.getSession();
        if (!session) return;
        
        // Try insert, ignore if exists (upsert)
        const authHeaders = {
            ...headers,
            'Authorization': `Bearer ${session.access_token}`,
            'Prefer': 'resolution=merge-duplicates'
        };

        await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
                id: userId,
                email: email,
                download_count: 0,
                plan: 'free'
            })
        });
    }

    static async incrementDownload() {
        const session = await this.getSession();
        if (!session) throw new Error("No session");

        const authHeaders = {
            ...headers,
            'Authorization': `Bearer ${session.access_token}`
        };

        // Call a Supabase RPC to safely increment
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/increment_download`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({ user_id: session.user.id })
        });

        if (!response.ok) {
            // Fallback if RPC doesn't exist: fetch current, increment, update
            // (You should create the RPC in Supabase later for safety)
            const profile = await this.getProfile();
            if (profile) {
                await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${session.user.id}`, {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({ download_count: profile.download_count + 1 })
                });
                return profile.download_count + 1;
            }
        } else {
            const currentCount = await response.json(); // RPC returns new count
            return currentCount;
        }
    }
}
