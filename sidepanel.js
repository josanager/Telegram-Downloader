// sidepanel.js — Misil v4.0 (Auth + Quota display only)

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const session = await SupabaseClient.getSession();
        if (session) await showDashboard();
        else showAuth();
    } catch { showAuth(); }
    setupAuthListeners();
});

// ── Views ──
function showAuth() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    setTag('Desconectado', false);
}

async function showDashboard() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    setTag('GRATIS', true);
    try {
        const p = await SupabaseClient.getProfile();
        if (p) {
            updateQuota(p.download_count || 0);
            setTag(p.plan === 'premium' ? 'PREMIUM' : 'GRATIS', true);
        }
    } catch { /* keep defaults */ }
}

function setTag(text, active) {
    const el = document.getElementById('plan-tag');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('on', active);
}

// ── Auth listeners ──
function setupAuthListeners() {
    const tabLogin    = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const btn         = document.getElementById('auth-submit-btn');
    const user        = document.getElementById('auth-user');
    const pass        = document.getElementById('auth-pass');
    const err         = document.getElementById('auth-error');

    tabLogin.onclick = () => {
        isLoginMode = true;
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
        btn.textContent = 'Entrar'; err.textContent = '';
    };
    tabRegister.onclick = () => {
        isLoginMode = false;
        tabRegister.classList.add('active'); tabLogin.classList.remove('active');
        btn.textContent = 'Crear Cuenta'; err.textContent = '';
    };

    btn.onclick = async () => {
        const u = user.value.trim(), p = pass.value.trim();
        if (!u || !p) { err.textContent = 'Llena todos los campos.'; return; }
        if (p.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }

        const email = `${u.toLowerCase().replace(/[^a-z0-9]/g, '')}@misil.app`;
        btn.disabled = true; btn.textContent = 'Conectando…'; err.textContent = '';
        try {
            if (isLoginMode) await SupabaseClient.signIn(email, p);
            else await SupabaseClient.signUp(email, p);
            await showDashboard();
        } catch (e) { err.textContent = e.message; }
        finally { btn.disabled = false; btn.textContent = isLoginMode ? 'Entrar' : 'Crear Cuenta'; }
    };

    document.getElementById('logout-btn').onclick = async () => {
        await SupabaseClient.signOut();
        showAuth();
    };
}

// ── Quota ring ──
function updateQuota(count) {
    const limit = 100;
    const el = document.getElementById('current-count');
    const rem = document.getElementById('remaining-count');
    const ring = document.getElementById('circle-fill');
    if (el) el.textContent = count;
    if (rem) rem.textContent = Math.max(0, limit - count);
    if (ring) {
        const r = 44, circ = 2 * Math.PI * r;
        ring.style.strokeDasharray = circ;
        ring.style.strokeDashoffset = circ - (count / limit) * circ;
    }
}

// ── Particles ──
(function initParticles() {
    const c = document.getElementById('particles-bg');
    if (!c) return;
    const ctx = c.getContext('2d');
    let w, h;
    const resize = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
    resize(); addEventListener('resize', resize);
    const pts = Array.from({ length: 40 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 2 + .5, dx: (Math.random() - .5) * .3, dy: (Math.random() - .5) * .3,
        a: Math.random() * .35 + .1
    }));
    (function draw() {
        ctx.clearRect(0, 0, w, h);
        pts.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,55,55,${p.a})`; ctx.fill();
        });
        requestAnimationFrame(draw);
    })();
})();
