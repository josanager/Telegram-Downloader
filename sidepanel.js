// sidepanel.js – Misil v2.3.0

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await SupabaseClient.getSession();
    if (session) showDashboard();
    else showAuth();

    setupAuthListeners();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'quota-update')        updateQuota(message.count);
        if (message.type === 'media-added')         addMediaToPanel(message.data);

        // Per-item download progress events
        if (message.type === 'panel-download-start')    setItemStatus(message.data.thumbId, 'Iniciando descarga...', 0);
        if (message.type === 'panel-download-size')     setItemSize(message.data.thumbId, message.data.totalMb);
        if (message.type === 'panel-download-progress') setItemStatus(message.data.thumbId, `${message.data.receivedMb} MB`, message.data.percent);
        if (message.type === 'panel-download-done') {
            setItemDone(message.data.thumbId, message.data.filename);
            // Refresh quota from Supabase after each successful download
            refreshQuotaFromSupabase();
        }
        if (message.type === 'panel-download-error')    setItemError(message.data.thumbId, message.data.error);
    });
});

async function refreshQuotaFromSupabase() {
    try {
        const profile = await SupabaseClient.getProfile();
        if (profile) updateQuota(profile.download_count);
    } catch {}
}

// ── AUTH ──
function showAuth() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    document.getElementById('plan-tag').textContent = 'Desconectado';
    document.getElementById('plan-tag').classList.remove('on');
}

async function showDashboard() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('plan-tag').classList.add('on');
    try {
        const profile = await SupabaseClient.getProfile();
        if (profile) {
            updateQuota(profile.download_count);
            document.getElementById('plan-tag').textContent = profile.plan === 'premium' ? 'PREMIUM' : 'GRATIS';
        }
    } catch { document.getElementById('plan-tag').textContent = 'GRATIS'; }
}

function setupAuthListeners() {
    const tabLogin   = document.getElementById('tab-login');
    const tabRegister= document.getElementById('tab-register');
    const submitBtn  = document.getElementById('auth-submit-btn');
    const userInput  = document.getElementById('auth-user');
    const passInput  = document.getElementById('auth-pass');
    const errorMsg   = document.getElementById('auth-error');

    tabLogin.onclick = () => {
        isLoginMode = true;
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
        submitBtn.textContent = 'Entrar'; errorMsg.textContent = '';
    };
    tabRegister.onclick = () => {
        isLoginMode = false;
        tabRegister.classList.add('active'); tabLogin.classList.remove('active');
        submitBtn.textContent = 'Crear Cuenta'; errorMsg.textContent = '';
    };
    submitBtn.onclick = async () => {
        const username = userInput.value.trim();
        const pwd = passInput.value.trim();
        if (!username || !pwd) { errorMsg.textContent = 'Llena todos los campos.'; return; }
        if (pwd.length < 6)    { errorMsg.textContent = 'Mínimo 6 caracteres.'; return; }

        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@misil.app`;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Conectando...';
        errorMsg.textContent = '';
        try {
            if (isLoginMode) await SupabaseClient.signIn(email, pwd);
            else             await SupabaseClient.signUp(email, pwd);
            showDashboard();
        } catch (err) {
            errorMsg.textContent = err.message;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLoginMode ? 'Entrar' : 'Crear Cuenta';
        }
    };
    document.getElementById('logout-btn').onclick = async () => {
        await SupabaseClient.signOut();
        showAuth();
    };
}

// ── QUOTA ──
function updateQuota(count) {
    const limit = 100;
    document.getElementById('current-count').textContent = count;
    document.getElementById('remaining-count').textContent = Math.max(0, limit - count);
    const radius = 34;
    const offset = (2 * Math.PI * radius) - (count / limit) * (2 * Math.PI * radius);
    document.getElementById('circle-fill').style.strokeDashoffset = offset;
}

// ── MEDIA PANEL ──

function addMediaToPanel(data) {
    const list  = document.getElementById('media-list');
    const empty = document.getElementById('media-empty');
    if (empty) empty.style.display = 'none';

    const item = document.createElement('div');
    item.id = 'mitem-' + data.thumbId;
    item.style.cssText = `
        padding: 12px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        display: flex;
        flex-direction: column;
        gap: 8px;
    `;

    const thumbHtml = data.thumbnail
        ? `<img src="${data.thumbnail}" style="width:48px;height:36px;border-radius:6px;object-fit:cover;flex-shrink:0;">`
        : `<div style="width:48px;height:36px;border-radius:6px;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;">${data.type==='Video'?'🎬':'🖼️'}</div>`;

    item.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
            ${thumbHtml}
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${data.name}">${data.name}</div>
                <div style="font-size:11px;color:#64748b;margin-top:2px;display:flex;gap:6px;align-items:center;">
                    <span class="m-type">${data.type}</span>
                    <span class="m-size" style="display:none;"></span>
                </div>
            </div>
        </div>
        <div class="m-bar-wrap" style="display:block;background:rgba(255,255,255,0.06);border-radius:4px;height:3px;overflow:hidden;">
            <div class="m-bar" style="height:100%;background:#FF3737;border-radius:4px;width:10%;transition:width .3s ease;animation:pulse-bar 1s infinite alternate;"></div>
        </div>
        <div class="m-status" style="font-size:11px;color:#64748b;display:block;">Buscando archivo original...</div>
    `;

    // Add pulse animation for indeterminate state if not exists
    if (!document.getElementById('pulse-anim-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-anim-style';
        style.textContent = '@keyframes pulse-bar { from { opacity: 0.5; } to { opacity: 1; } }';
        document.head.appendChild(style);
    }

    list.prepend(item); // Add to top of list
}

function getItem(thumbId) {
    return document.getElementById('mitem-' + thumbId);
}

function setItemStatus(thumbId, text, percent) {
    const el = getItem(thumbId); if (!el) return;
    const barWrap = el.querySelector('.m-bar-wrap');
    const bar     = el.querySelector('.m-bar');
    const status  = el.querySelector('.m-status');

    if (barWrap) { barWrap.style.display = 'block'; }
    if (bar)     { bar.style.width = percent + '%'; bar.style.animation = 'none'; }
    if (status)  { status.style.display = 'block'; status.textContent = text; status.style.color = '#64748b'; }
}

function setItemSize(thumbId, totalMb) {
    const el = getItem(thumbId); if (!el) return;
    const sizeEl = el.querySelector('.m-size');
    if (sizeEl) { sizeEl.style.display = 'inline'; sizeEl.textContent = totalMb + ' MB'; }
}

function setItemDone(thumbId, filename) {
    const el = getItem(thumbId); if (!el) return;
    const bar     = el.querySelector('.m-bar');
    const status  = el.querySelector('.m-status');
    if (bar)    { bar.style.width = '100%'; bar.style.background = '#22c55e'; bar.style.animation = 'none'; }
    if (status) { status.textContent = '✅ ¡Descargado!'; status.style.color = '#22c55e'; }
}

function setItemError(thumbId, error) {
    const el = getItem(thumbId); if (!el) return;
    const bar     = el.querySelector('.m-bar');
    const status  = el.querySelector('.m-status');
    if (bar)    { bar.style.width = '100%'; bar.style.background = '#ef4444'; bar.style.animation = 'none'; }
    if (status) { status.textContent = '⛔ ' + error; status.style.color = '#ef4444'; }
}

// ── PARTICLES VIVO EFECT ──
function initParticles() {
    const canvas = document.getElementById("particles-bg");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    let width, height;
    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const particles = [];
    const config = {
        count: 50,
        speed: 0.3,
        color: 'rgba(255, 55, 55, '
    };

    for (let i = 0; i < config.count; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 2.5 + 0.5,
            dx: (Math.random() - 0.5) * config.speed,
            dy: (Math.random() - 0.5) * config.speed,
            alpha: Math.random() * 0.4 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            
            // Seamless wrap around
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = config.color + p.alpha + ')';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}
initParticles();
