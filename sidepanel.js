// sidepanel.js – Misil v2.1

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await SupabaseClient.getSession();
    if (session) showDashboard();
    else showAuth();

    setupAuthListeners();
    setupTabSwitcher();

    const historyData = await chrome.storage.local.get(['download_history']);
    renderHistory(historyData.download_history || []);

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'quota-update') updateQuota(message.count);
        if (message.type === 'history-updated') renderHistory(message.history);
        if (message.type === 'media-added') addMediaToPanel(message.data);
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
    } catch (e) {
        document.getElementById('plan-tag').textContent = 'GRATIS';
    }
}

function setupAuthListeners() {
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const submitBtn = document.getElementById('auth-submit-btn');
    const userInput = document.getElementById('auth-user');
    const passInput = document.getElementById('auth-pass');
    const errorMsg = document.getElementById('auth-error');

    tabLogin.onclick = () => {
        isLoginMode = true;
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        submitBtn.textContent = 'Entrar';
        errorMsg.textContent = '';
    };

    tabRegister.onclick = () => {
        isLoginMode = false;
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        submitBtn.textContent = 'Crear Cuenta';
        errorMsg.textContent = '';
    };

    submitBtn.onclick = async () => {
        const username = userInput.value.trim();
        const pwd = passInput.value.trim();
        if (!username || !pwd) { errorMsg.textContent = 'Llena todos los campos.'; return; }
        if (pwd.length < 6) { errorMsg.textContent = 'Mínimo 6 caracteres en la contraseña.'; return; }

        const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '')}@misil.app`;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Conectando...';
        errorMsg.textContent = '';

        try {
            if (isLoginMode) await SupabaseClient.signIn(email, pwd);
            else await SupabaseClient.signUp(email, pwd);
            showDashboard();
        } catch (err) {
            errorMsg.textContent = err.message || 'Error de conexión';
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = isLoginMode ? 'Entrar' : 'Crear Cuenta';
        }
    };

    document.getElementById('logout-btn').onclick = async () => {
        try {
            await SupabaseClient.signOut();
        } catch (e) {
            console.error("[Misil] Sign out error:", e);
        } finally {
            showAuth();
        }
    };
}

// ── TABS ──
function setupTabSwitcher() {
    const tabMedia = document.getElementById('tab-media');
    const tabHistory = document.getElementById('tab-history');
    const panelMedia = document.getElementById('panel-media');
    const panelHistory = document.getElementById('panel-history');

    tabMedia.onclick = () => {
        tabMedia.classList.add('active'); tabHistory.classList.remove('active');
        panelMedia.classList.remove('hidden'); panelHistory.classList.add('hidden');
    };
    tabHistory.onclick = () => {
        tabHistory.classList.add('active'); tabMedia.classList.remove('active');
        panelHistory.classList.remove('hidden'); panelMedia.classList.add('hidden');
    };
}

// ── QUOTA ──
function updateQuota(count) {
    const limit = 100;
    document.getElementById('current-count').textContent = count;
    document.getElementById('remaining-count').textContent = Math.max(0, limit - count);
    const radius = 34;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (count / limit) * circumference;
    document.getElementById('circle-fill').style.strokeDashoffset = offset;
}

// ── MEDIA PANEL ──
const addedThumbs = new Set();

function addMediaToPanel(data) {
    if (addedThumbs.has(data.thumbId)) return;
    addedThumbs.add(data.thumbId);

    const list = document.getElementById('media-list');
    const empty = document.getElementById('media-empty');
    if (empty) empty.style.display = 'none';

    // Switch to multimedia tab
    document.getElementById('tab-media').click();

    const item = document.createElement('div');
    item.className = 'm-item';
    item.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);';

    const thumbHtml = data.thumbnail
        ? `<div style="width:50px;height:36px;border-radius:6px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,0.05);">
             <img src="${data.thumbnail}" style="width:100%;height:100%;object-fit:cover;">
           </div>`
        : `<div style="width:50px;height:36px;border-radius:6px;flex-shrink:0;background:rgba(255,255,255,0.05);display:flex;align-items:center;justify-content:center;font-size:18px;">
             ${data.type === 'Video' ? '🎬' : '🖼️'}
           </div>`;

    item.innerHTML = `
        ${thumbHtml}
        <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${data.name}">${data.name}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">${data.type}</div>
        </div>
    `;

    // Download button
    const dlBtn = document.createElement('button');
    dlBtn.style.cssText = 'width:32px;height:32px;border-radius:8px;background:#FF3737;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:transform 0.1s;';
    dlBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:white;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
    dlBtn.title = "Descargar";
    dlBtn.onmouseover = () => dlBtn.style.transform = 'scale(1.1)';
    dlBtn.onmouseout = () => dlBtn.style.transform = 'scale(1)';
    dlBtn.onclick = () => {
        dlBtn.disabled = true;
        dlBtn.innerHTML = '<div style="width:14px;height:14px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin .6s linear infinite;"></div>';
        // Tell the page to open the viewer for this media and auto-download
        chrome.tabs.query({ url: "*://web.telegram.org/*" }, (tabs) => {
            if (tabs.length > 0) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'trigger-panel-download',
                    data: { thumbId: data.thumbId }
                });
            }
        });
    };

    item.appendChild(dlBtn);
    list.appendChild(item);
}

// ── HISTORY ──
function renderHistory(history) {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-state');
    list.querySelectorAll('.h-item').forEach(el => el.remove());

    if (!history || history.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'h-item';
        li.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);';
        const isVideo = /\.(mp4|webm|mkv)$/i.test(item.name);
        const icon = isVideo ? '🎬' : '🖼️';
        li.innerHTML = `
            <div style="width:34px;height:34px;border-radius:8px;background:rgba(255,55,55,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:16px;">${icon}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                <div style="font-size:10px;color:#64748b;margin-top:2px;">${item.date}</div>
            </div>
        `;
        list.appendChild(li);
    });
}

// Add spin animation
const style = document.createElement('style');
style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}';
document.head.appendChild(style);
