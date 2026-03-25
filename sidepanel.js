// sidepanel.js – Misil v2.1

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await SupabaseClient.getSession();
    if (session) {
        showDashboard();
    } else {
        showAuth();
    }

    setupAuthListeners();
    setupTabSwitcher();

    const historyData = await chrome.storage.local.get(['download_history']);
    renderHistory(historyData.download_history || []);

    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'quota-update') updateQuota(message.count);
        if (message.type === 'history-updated') renderHistory(message.history);
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
            if (isLoginMode) {
                await SupabaseClient.signIn(email, pwd);
            } else {
                await SupabaseClient.signUp(email, pwd);
            }
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
        const isVideo = /\.(mp4|webm|mkv)$/i.test(item.name);
        const iconSvg = isVideo
            ? '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';

        li.innerHTML = `
            <div class="h-icon">${iconSvg}</div>
            <div class="h-info">
                <div class="h-name" title="${item.name}">${item.name}</div>
                <div class="h-date">${item.date}</div>
            </div>
        `;
        list.appendChild(li);
    });
}
