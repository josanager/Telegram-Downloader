// sidepanel.js — Misil v4.5 (Auth Redesign + i18n)

let isLoginMode = true;
let currentLang = localStorage.getItem('misil_lang') || 'es';

const TRANSLATIONS = {
    es: {
        welcome_title: "El mejor descargador para Telegram Web",
        btn_login: "Iniciar Sesión",
        btn_register: "Registrarse",
        auth_desc: "Activa tus 100 descargas gratis",
        user_placeholder: "Usuario",
        pass_placeholder: "Contraseña",
        btn_back: "← Volver",
        toggle_login: "¿Ya tienes cuenta? Inicia sesión",
        toggle_register: "¿No tienes cuenta? Registrate",
        login_header: "Iniciar Sesión",
        register_header: "Registrarse",
        instructions: "Usa el icono de Misil en Telegram<br>para descargar archivos multimedia.<br>Las descargas se guardan en tu carpeta local.",
        btn_logout: "Cerrar Sesión",
        btn_submit_login: "Entrar",
        btn_submit_register: "Crear Cuenta",
        plan_free: "GRATIS",
        plan_premium: "PREMIUM",
        dashboard_title: "Tus Descargas",
        ring_of: "de",
        remaining_prefix: "Te quedan",
        remaining_suffix: "descargas este mes"
    },
    en: {
        welcome_title: "The best Telegram Web downloader",
        btn_login: "Login",
        btn_register: "Register",
        auth_desc: "Activate your 100 free downloads",
        user_placeholder: "Username",
        pass_placeholder: "Password",
        btn_back: "← Back",
        toggle_login: "Already have an account? Login",
        toggle_register: "Don't have an account? Register",
        login_header: "Login",
        register_header: "Register",
        instructions: "Use the Misil icon in Telegram<br>to download media files.<br>Downloads are saved to your local folder.",
        btn_logout: "Logout",
        btn_submit_login: "Sign In",
        btn_submit_register: "Create Account",
        plan_free: "FREE",
        plan_premium: "PREMIUM",
        dashboard_title: "Your Downloads",
        ring_of: "of",
        remaining_prefix: "You have",
        remaining_suffix: "downloads this month"
    },
    ru: {
        welcome_title: "Лучший загрузчик для Telegram Web",
        btn_login: "Войти",
        btn_register: "Регистрация",
        auth_desc: "Активируйте 100 бесплатных загрузок",
        user_placeholder: "Имя пользователя",
        pass_placeholder: "Пароль",
        btn_back: "← Назад",
        toggle_login: "Уже есть аккаунт? Войти",
        toggle_register: "Нет аккаунта? Зарегистрироваться",
        login_header: "Вход",
        register_header: "Регистрация",
        instructions: "Используйте значок Misil в Telegram,<br>чтобы скачивать медиафайлы.<br>Файлы сохраняются в локальную папку.",
        btn_logout: "Выйти",
        btn_submit_login: "Войти",
        btn_submit_register: "Создать аккаунт",
        plan_free: "БЕСПЛАТНО",
        plan_premium: "ПРЕМИУМ",
        dashboard_title: "Ваши загрузки",
        ring_of: "из",
        remaining_prefix: "У вас осталось",
        remaining_suffix: "загрузок в этом месяце"
    },
    hi: {
        welcome_title: "टेलीग्राम वेब के लिए सबसे अच्छा डाउनलोडर",
        btn_login: "लॉगिन करें",
        btn_register: "रजिस्टर करें",
        auth_desc: "100 मुफ्त डाउनलोड सक्रिय करें",
        user_placeholder: "उपयोगकर्ता नाम",
        pass_placeholder: "पासवर्ड",
        btn_back: "← वापस",
        toggle_login: "पहले से ही खाता है? लॉगिन करें",
        toggle_register: "खाता नहीं है? रजिस्टर करें",
        login_header: "लॉगिन",
        register_header: "रजिस्टर",
        instructions: "टेलीग्राम में मिसिल आइकन का उपयोग करें<br>मीडिया फ़ाइलों को डाउनलोड करने के लिए।<br>डाउनलोड आपके स्थानीय फ़ोल्डर में सहेजे जाते हैं।",
        btn_logout: "लॉगआउट",
        btn_submit_login: "साइन इन करें",
        btn_submit_register: "खाता बनाएँ",
        plan_free: "मुफ्त",
        plan_premium: "प्रीमियम",
        dashboard_title: "आपके डाउनलोड",
        ring_of: "में से",
        remaining_prefix: "आपके पास हैं",
        remaining_suffix: "इस महीने डाउनलोड"
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initI18n();
    try {
        const session = await SupabaseClient.getSession();
        if (session) await showDashboard();
        else showWelcome();
    } catch { showWelcome(); }
    setupAuthListeners();
});

function initI18n() {
    const select = document.getElementById('lang-select');
    select.value = currentLang;
    select.onchange = async (e) => {
        currentLang = e.target.value;
        localStorage.setItem('misil_lang', currentLang);
        await updateLanguage();
    };
    updateLanguage();
}

async function updateLanguage() {
    const dict = TRANSLATIONS[currentLang];
    
    // Update data-i18n items
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });

    // Update data-i18n-attr items (like placeholders)
    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
        if (dict[key]) el.setAttribute(attr, dict[key]);
    });

    // Special case: update submit button text based on mode
    updateAuthStrings();

    // Re-run quota update to refresh remaining text with new language
    try {
        const p = await SupabaseClient.getProfile();
        if (p) updateQuota(p.download_count || 0);
        else updateQuota(0);
        
        // Also refresh tag
        const session = await SupabaseClient.getSession();
        if (session) {
            const plan = (p && p.plan === 'premium') ? 'premium' : 'free';
            setTag(dict['plan_' + plan], true);
        }
    } catch { /* session might not be ready */ }
}

// ── Views ──
function showWelcome() {
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('welcome-view').classList.remove('hidden');
}

function showAuthForm(mode) {
    isLoginMode = mode === 'login';
    document.getElementById('welcome-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
    updateAuthStrings();
}

function updateAuthStrings() {
    const dict = TRANSLATIONS[currentLang];
    const title = document.getElementById('auth-title');
    const toggle = document.getElementById('auth-toggle-btn');
    const submit = document.getElementById('auth-submit-btn');
    
    if (isLoginMode) {
        title.textContent = dict.login_header;
        toggle.textContent = dict.toggle_register;
        submit.textContent = dict.btn_submit_login;
    } else {
        title.textContent = dict.register_header;
        toggle.textContent = dict.toggle_login;
        submit.textContent = dict.btn_submit_register;
    }
}

async function showDashboard() {
    document.getElementById('welcome-view').classList.add('hidden');
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    setTag('GRATIS', true);

    const session = await SupabaseClient.getSession();
    if (session && session.user && session.user.email) {
        let rawUsername = session.user.email.split('@')[0];
        let username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
        document.getElementById('user-name').textContent = username;
        document.getElementById('user-avatar').textContent = username.charAt(0);
    }
    try {
        const p = await SupabaseClient.getProfile();
        if (p) {
            updateQuota(p.download_count || 0);
            const planKey = (p.plan === 'premium') ? 'plan_premium' : 'plan_free';
            setTag(TRANSLATIONS[currentLang][planKey], true);
        }
    } catch { /* keep defaults */ }
}

function showAuth() { showWelcome(); } // Legacy helper

function setTag(text, active) {
    const ids = ['plan-tag', 'plan-tag-auth'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
            el.classList.toggle('on', active);
        }
    });
}

// ── Auth listeners ──
function setupAuthListeners() {
    const btnLogin    = document.getElementById('welcome-login-btn');
    const btnRegister = document.getElementById('welcome-register-btn');
    const btnToggle   = document.getElementById('auth-toggle-btn');
    const btnBack     = document.getElementById('auth-back-btn');
    const btnSubmit   = document.getElementById('auth-submit-btn');
    
    const user = document.getElementById('auth-user');
    const pass = document.getElementById('auth-pass');
    const err  = document.getElementById('auth-error');

    btnLogin.onclick    = () => showAuthForm('login');
    btnRegister.onclick = () => showAuthForm('register');
    btnBack.onclick     = () => showWelcome();
    
    btnToggle.onclick = () => {
        isLoginMode = !isLoginMode;
        updateAuthStrings();
        err.textContent = '';
    };

    btnSubmit.onclick = async () => {
        const u = user.value.trim(), p = pass.value.trim();
        if (!u || !p) { err.textContent = TRANSLATIONS[currentLang].login_header; return; } // Simplified error for now
        if (p.length < 6) { err.textContent = 'Mínimo 6 caracteres.'; return; }

        const email = `${u.toLowerCase().replace(/[^a-z0-9]/g, '')}@misil.app`;
        btnSubmit.disabled = true; btnSubmit.textContent = '...'; err.textContent = '';
        try {
            if (isLoginMode) await SupabaseClient.signIn(email, p);
            else await SupabaseClient.signUp(email, p);
            await showDashboard();
        } catch (e) { err.textContent = e.message; }
        finally { btnSubmit.disabled = false; updateAuthStrings(); }
    };

    document.getElementById('logout-btn').onclick = async () => {
        await SupabaseClient.signOut();
        showAuth();
    };
}

// ── Quota ring ──
function updateQuota(count) {
    const limit = 100;
    const dict = TRANSLATIONS[currentLang];
    const el = document.getElementById('current-count');
    const rem_wrap = document.getElementById('remaining-wrap');
    const ring_of = document.getElementById('ring-of');
    const ring = document.getElementById('circle-fill');

    if (el) el.textContent = count;
    if (ring_of) ring_of.textContent = dict.ring_of + ' ' + limit;
    
    if (rem_wrap) {
        rem_wrap.innerHTML = `${dict.remaining_prefix} <strong id="remaining-count" style="color:var(--primary)">${Math.max(0, limit - count)}</strong> ${dict.remaining_suffix}`;
    }

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
