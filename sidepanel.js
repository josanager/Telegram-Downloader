// sidepanel.js – Misil v2.2

let isLoginMode = true;
const addedThumbs = new Set();

document.addEventListener('DOMContentLoaded', async () => {
    const session = await SupabaseClient.getSession();
    if (session) showDashboard();
    else showAuth();

    setupAuthListeners();
    setupTabSwitcher();

    const { download_history = [] } = await chrome.storage.local.get(['download_history']);
    renderHistory(download_history);

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'quota-update')        updateQuota(message.count);
        if (message.type === 'history-updated')     renderHistory(message.history);
        if (message.type === 'media-added')         addMediaToPanel(message.data);

        // Per-item download progress events
        if (message.type === 'panel-download-start')    setItemStatus(message.data.thumbId, 'Iniciando...', 0);
        if (message.type === 'panel-download-size')     setItemSize(message.data.thumbId, message.data.totalMb);
        if (message.type === 'panel-download-progress') setItemStatus(message.data.thumbId, `${message.data.receivedMb} MB`, message.data.percent);
        if (message.type === 'panel-download-done')     setItemDone(message.data.thumbId, message.data.filename);
        if (message.type === 'panel-download-error')    setItemError(message.data.thumbId, message.data.error);
    });
});

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

// ── TABS ──
function setupTabSwitcher() {
    const tabMedia   = document.getElementById('tab-media');
    const tabHistory = document.getElementById('tab-history');
    const panelMedia = document.getElementById('panel-media');
    const panelHist  = document.getElementById('panel-history');

    tabMedia.onclick = () => {
        tabMedia.classList.add('active');   tabHistory.classList.remove('active');
        panelMedia.classList.remove('hidden'); panelHist.classList.add('hidden');
    };
    tabHistory.onclick = () => {
        tabHistory.classList.add('active'); tabMedia.classList.remove('active');
        panelHist.classList.remove('hidden'); panelMedia.classList.add('hidden');
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
    if (addedThumbs.has(data.thumbId)) return;
    addedThumbs.add(data.thumbId);

    const list  = document.getElementById('media-list');
    const empty = document.getElementById('media-empty');
    if (empty) empty.style.display = 'none';

    // Switch to multimedia tab
    document.getElementById('tab-media').click();

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
            <button class="m-dl-btn" style="width:32px;height:32px;border-radius:8px;background:#FF3737;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform .1s;" title="Descargar">
                <svg viewBox="0 0 24 24" style="width:15px;height:15px;fill:white;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            </button>
        </div>
        <div class="m-bar-wrap" style="display:none;background:rgba(255,255,255,0.06);border-radius:4px;height:3px;overflow:hidden;">
            <div class="m-bar" style="height:100%;background:#FF3737;border-radius:4px;width:0%;transition:width .3s ease;"></div>
        </div>
        <div class="m-status" style="font-size:11px;color:#64748b;display:none;"></div>
    `;

    // Download button click
    item.querySelector('.m-dl-btn').onclick = () => {
        chrome.tabs.query({ url: '*://web.telegram.org/*' }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'trigger-panel-download',
                    data: { thumbId: data.thumbId }
                });
            }
        });
    };

    // Hover effect on download button
    const dlBtn = item.querySelector('.m-dl-btn');
    dlBtn.onmouseover = () => dlBtn.style.transform = 'scale(1.1)';
    dlBtn.onmouseout  = () => dlBtn.style.transform = 'scale(1)';

    list.appendChild(item);
}

function getItem(thumbId) {
    return document.getElementById('mitem-' + thumbId);
}

function setItemStatus(thumbId, text, percent) {
    const el = getItem(thumbId); if (!el) return;
    const barWrap = el.querySelector('.m-bar-wrap');
    const bar     = el.querySelector('.m-bar');
    const status  = el.querySelector('.m-status');
    const dlBtn   = el.querySelector('.m-dl-btn');

    if (barWrap) { barWrap.style.display = 'block'; }
    if (bar)     { bar.style.width = percent + '%'; }
    if (status)  { status.style.display = 'block'; status.textContent = text; }
    if (dlBtn)   { dlBtn.style.display = 'none'; } // hide button while downloading
}

function setItemSize(thumbId, totalMb) {
    const el = getItem(thumbId); if (!el) return;
    const sizeEl = el.querySelector('.m-size');
    if (sizeEl) { sizeEl.style.display = 'inline'; sizeEl.textContent = totalMb + ' MB'; }
}

function setItemDone(thumbId, filename) {
    const el = getItem(thumbId); if (!el) return;
    const bar    = el.querySelector('.m-bar');
    const status = el.querySelector('.m-status');
    const dlBtn  = el.querySelector('.m-dl-btn');
    if (bar)    { bar.style.width = '100%'; bar.style.background = '#22c55e'; }
    if (status) { status.textContent = '✅ ¡Descargado!'; status.style.color = '#22c55e'; }
    if (dlBtn)  { dlBtn.style.display = 'none'; }

    // Move to history after 3s
    setTimeout(() => el.remove(), 3000);
}

function setItemError(thumbId, error) {
    const el = getItem(thumbId); if (!el) return;
    const bar    = el.querySelector('.m-bar');
    const status = el.querySelector('.m-status');
    const dlBtn  = el.querySelector('.m-dl-btn');
    if (bar)    { bar.style.width = '100%'; bar.style.background = '#ef4444'; }
    if (status) { status.textContent = '⛔ ' + error; status.style.color = '#ef4444'; }
    if (dlBtn)  { dlBtn.style.display = 'flex'; dlBtn.disabled = false; }
}

// ── HISTORY ──
function renderHistory(history) {
    const list  = document.getElementById('history-list');
    const empty = document.getElementById('empty-state');
    list.querySelectorAll('.h-item').forEach(el => el.remove());

    if (!history || history.length === 0) {
        empty.style.display = 'block'; return;
    }
    empty.style.display = 'none';

    history.forEach(item => {
        const li  = document.createElement('li');
        li.className = 'h-item';
        li.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
        const isVideo = /\.(mp4|webm|mkv)$/i.test(item.name);
        li.innerHTML = `
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,55,55,0.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">
                ${isVideo ? '🎬' : '🖼️'}
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">${item.date}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

// Spin animation for loading states
const style = document.createElement('style');
style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
document.head.appendChild(style);
