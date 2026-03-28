// sidepanel.js — Misil v4.7 (3 plans + onboarding)

let isLoginMode = true;
let currentLang = localStorage.getItem('misil_lang') || 'es';
let isPlanOnboarding = false;
let planPollTimer = null;

const PLAN_ONBOARDING_KEY = 'misil_plan_onboarding_user';
const ENV = 'sandbox'; // cambiar a 'production' luego

const PLAN_MONTHLY = {
    sandbox: 'plan_GZP5RdJlimquB',
    production: 'plan_55VkaAmYwx8cw'
};

const PLAN_LIFETIME = {
    sandbox: 'plan_CM6wwdiHX63DB',
    production: 'plan_KiU8TyxtJZ4c2'
};

const BASE_URL = {
    sandbox: 'https://sandbox.whop.com/checkout',
    production: 'https://whop.com/checkout'
};

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
        plan_free: "FREE",
        plan_pro: "PRO",
        plan_forever: "FOREVER",
        dashboard_title: "Tus Descargas",
        ring_of: "de",
        remaining_prefix: "Te quedan",
        remaining_suffix: "descargas este mes",
        remaining_unlimited: "Descargas Ilimitadas",
        btn_upgrade: "Ver planes",
        plans_hint: "Plan gratis: 100 archivos multimedia/mes y hasta 500MB por archivo.",
        credits_ended: "Se te acabaron los créditos",
        plans_title: "Planes",
        plans_subtitle: "Elige el plan que quieres usar en Misil.",
        plans_onboarding_subtitle: "Elige un plan para continuar. Debes seleccionar uno para entrar.",
        plan_free_name: "Free",
        plan_free_price: "$0",
        plan_free_desc: "100 archivos multimedia al mes y hasta 500MB por archivo.",
        plan_monthly_name: "Pro",
        plan_monthly_price: "$4.99/mes",
        plan_monthly_desc: "Descargas ilimitadas de fotos y videos, sin límite de tamaño.",
        plan_lifetime_name: "Forever",
        plan_lifetime_price: "29,99 US$",
        plan_lifetime_desc: "Pago único para siempre con descargas ilimitadas de fotos y videos, sin límite de tamaño.",
        btn_choose_free: "Elegir Free",
        btn_continue_free: "Continuar con Free",
        btn_choose_pro: "Elegir Pro",
        btn_choose_forever: "Elegir Forever",
        btn_current_plan: "Plan actual",
        btn_included: "Incluido",
        settings_title: "Configuración",
        settings_payment_title: "Pago y plan",
        settings_payment_desc: "Gestiona tu plan Free, Pro o Forever.",
        settings_open_plans: "Ver planes",
        settings_account_title: "Cuenta",
        settings_username_placeholder: "Nuevo usuario",
        settings_password_placeholder: "Nueva contraseña",
        settings_save_username: "Guardar usuario",
        settings_save_password: "Guardar contraseña",
        pro_active: "PRO ACTIVO",
        forever_active: "FOREVER ACTIVO",
        save_success: "Cambios guardados.",
        invalid_user: "Usuario inválido.",
        min_chars: "Mínimo 6 caracteres.",
        checkout_unavailable: "Este plan aún no tiene ID sandbox configurado.",
        plans_payment_pending: "Completa el pago y esta pantalla se actualizará automáticamente.",
        plans_paid_ready: "Pago detectado. Entrando al panel...",
        plans_free_ready: "Plan Free seleccionado.",
        plans_waiting_forever: "Esperando activación del plan Forever..."
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
        plan_pro: "PRO",
        plan_forever: "FOREVER",
        dashboard_title: "Your Downloads",
        ring_of: "of",
        remaining_prefix: "You have",
        remaining_suffix: "downloads this month",
        remaining_unlimited: "Unlimited Downloads",
        btn_upgrade: "View plans",
        plans_hint: "Free plan: 100 media files/month and up to 500MB per file.",
        credits_ended: "You ran out of credits",
        plans_title: "Plans",
        plans_subtitle: "Choose the plan you want to use in Misil.",
        plans_onboarding_subtitle: "Choose a plan to continue. You must select one to enter.",
        plan_free_name: "Free",
        plan_free_price: "$0",
        plan_free_desc: "100 media files per month and up to 500MB per file.",
        plan_monthly_name: "Pro",
        plan_monthly_price: "$4.99/month",
        plan_monthly_desc: "Unlimited photo and video downloads with no size limit.",
        plan_lifetime_name: "Forever",
        plan_lifetime_price: "US$ 29.99",
        plan_lifetime_desc: "One-time payment forever with unlimited photo and video downloads and no size limit.",
        btn_choose_free: "Choose Free",
        btn_continue_free: "Continue with Free",
        btn_choose_pro: "Choose Pro",
        btn_choose_forever: "Choose Forever",
        btn_current_plan: "Current plan",
        btn_included: "Included",
        settings_title: "Settings",
        settings_payment_title: "Payment & plan",
        settings_payment_desc: "Manage your Free, Pro or Forever plan.",
        settings_open_plans: "View plans",
        settings_account_title: "Account",
        settings_username_placeholder: "New username",
        settings_password_placeholder: "New password",
        settings_save_username: "Save username",
        settings_save_password: "Save password",
        pro_active: "PRO ENABLED",
        forever_active: "FOREVER ENABLED",
        save_success: "Changes saved.",
        invalid_user: "Invalid username.",
        min_chars: "Minimum 6 characters.",
        checkout_unavailable: "This plan does not have a sandbox ID configured yet.",
        plans_payment_pending: "Complete payment and this screen will update automatically.",
        plans_paid_ready: "Payment detected. Opening dashboard...",
        plans_free_ready: "Free plan selected.",
        plans_waiting_forever: "Waiting for Forever plan activation..."
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
        plan_free: "FREE",
        plan_pro: "PRO",
        plan_forever: "FOREVER",
        dashboard_title: "Ваши загрузки",
        ring_of: "из",
        remaining_prefix: "У вас осталось",
        remaining_suffix: "загрузок в этом месяце",
        remaining_unlimited: "Безлимитно",
        btn_upgrade: "Смотреть планы",
        plans_hint: "Бесплатный план: 100 медиафайлов в месяц и до 500MB на файл.",
        credits_ended: "Кредиты закончились",
        plans_title: "Тарифы",
        plans_subtitle: "Выберите тариф, который хотите использовать в Misil.",
        plans_onboarding_subtitle: "Выберите тариф для продолжения. Нужно выбрать один, чтобы войти.",
        plan_free_name: "Free",
        plan_free_price: "$0",
        plan_free_desc: "100 медиафайлов в месяц и до 500MB на файл.",
        plan_monthly_name: "Pro",
        plan_monthly_price: "$4.99/месяц",
        plan_monthly_desc: "Безлимитные загрузки фото и видео без лимита размера.",
        plan_lifetime_name: "Forever",
        plan_lifetime_price: "29,99 US$",
        plan_lifetime_desc: "Разовая оплата навсегда: безлимитные загрузки фото и видео без лимита размера.",
        btn_choose_free: "Выбрать Free",
        btn_continue_free: "Продолжить с Free",
        btn_choose_pro: "Выбрать Pro",
        btn_choose_forever: "Выбрать Forever",
        btn_current_plan: "Текущий план",
        btn_included: "Включено",
        settings_title: "Настройки",
        settings_payment_title: "Оплата и тариф",
        settings_payment_desc: "Управляйте тарифом Free, Pro или Forever.",
        settings_open_plans: "Смотреть планы",
        settings_account_title: "Аккаунт",
        settings_username_placeholder: "Новое имя",
        settings_password_placeholder: "Новый пароль",
        settings_save_username: "Сохранить имя",
        settings_save_password: "Сохранить пароль",
        pro_active: "PRO АКТИВЕН",
        forever_active: "FOREVER АКТИВЕН",
        save_success: "Изменения сохранены.",
        invalid_user: "Недопустимое имя.",
        min_chars: "Минимум 6 символов.",
        checkout_unavailable: "Для этого плана еще не настроен sandbox ID.",
        plans_payment_pending: "Завершите оплату, и этот экран обновится автоматически.",
        plans_paid_ready: "Платеж обнаружен. Открываем панель...",
        plans_free_ready: "План Free выбран.",
        plans_waiting_forever: "Ожидание активации плана Forever..."
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
        plan_free: "FREE",
        plan_pro: "PRO",
        plan_forever: "FOREVER",
        dashboard_title: "आपके डाउनलोड",
        ring_of: "में से",
        remaining_prefix: "आपके पास हैं",
        remaining_suffix: "इस महीने डाउनलोड",
        remaining_unlimited: "असीमित डाउनलोड",
        btn_upgrade: "प्लान देखें",
        plans_hint: "फ्री प्लान: 100 मीडिया फाइल/महीना और प्रति फाइल 500MB तक।",
        credits_ended: "आपके क्रेडिट खत्म हो गए",
        plans_title: "प्लान",
        plans_subtitle: "Misil में इस्तेमाल करने के लिए अपना प्लान चुनें।",
        plans_onboarding_subtitle: "आगे बढ़ने के लिए एक प्लान चुनें। अंदर जाने के लिए एक चुनना ज़रूरी है।",
        plan_free_name: "Free",
        plan_free_price: "$0",
        plan_free_desc: "100 मीडिया फाइल प्रति माह और प्रति फाइल 500MB तक।",
        plan_monthly_name: "Pro",
        plan_monthly_price: "$4.99/महीना",
        plan_monthly_desc: "फोटो और वीडियो के असीमित डाउनलोड, बिना साइज लिमिट।",
        plan_lifetime_name: "Forever",
        plan_lifetime_price: "29,99 US$",
        plan_lifetime_desc: "एक बार भुगतान, हमेशा के लिए फोटो और वीडियो के असीमित डाउनलोड, बिना साइज लिमिट।",
        btn_choose_free: "Free चुनें",
        btn_continue_free: "Free के साथ जारी रखें",
        btn_choose_pro: "Pro चुनें",
        btn_choose_forever: "Forever चुनें",
        btn_current_plan: "मौजूदा प्लान",
        btn_included: "शामिल",
        settings_title: "सेटिंग्स",
        settings_payment_title: "भुगतान और प्लान",
        settings_payment_desc: "अपने Free, Pro या Forever प्लान को मैनेज करें।",
        settings_open_plans: "प्लान देखें",
        settings_account_title: "खाता",
        settings_username_placeholder: "नया यूज़रनेम",
        settings_password_placeholder: "नया पासवर्ड",
        settings_save_username: "यूज़रनेम सेव करें",
        settings_save_password: "पासवर्ड सेव करें",
        pro_active: "PRO सक्रिय",
        forever_active: "FOREVER सक्रिय",
        save_success: "बदलाव सेव हो गए।",
        invalid_user: "अमान्य यूज़रनेम।",
        min_chars: "कम से कम 6 अक्षर।",
        checkout_unavailable: "इस प्लान के लिए sandbox ID अभी सेट नहीं है।",
        plans_payment_pending: "पेमेंट पूरा करें, यह स्क्रीन अपने आप अपडेट हो जाएगी।",
        plans_paid_ready: "पेमेंट मिल गया। डैशबोर्ड खोला जा रहा है...",
        plans_free_ready: "Free प्लान चुना गया।",
        plans_waiting_forever: "Forever प्लान एक्टिवेशन का इंतज़ार..."
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    initI18n();
    setupAuthListeners();
    try {
        await routeInitialView();
    } catch {
        showWelcome();
    }
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

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.innerHTML = dict[key];
    });

    document.querySelectorAll('[data-i18n-attr]').forEach(el => {
        const [attr, key] = el.getAttribute('data-i18n-attr').split(':');
        if (dict[key]) el.setAttribute(attr, dict[key]);
    });

    updateAuthStrings();

    try {
        const profile = await SupabaseClient.getProfile();
        const currentPlan = normalizePlan(profile?.plan);
        await updateQuota(profile?.download_count || 0, currentPlan);
        setTag(dict[`plan_${currentPlan}`], true);
        if (!document.getElementById('plans-view')?.classList.contains('hidden')) {
            renderPlansHeader();
            renderPlansState(profile);
        }
    } catch {}
}

function normalizePlan(plan) {
    if (plan === 'pro') return 'pro';
    if (plan === 'forever') return 'forever';
    return 'free';
}

function markPlanOnboarding(userId) {
    localStorage.setItem(PLAN_ONBOARDING_KEY, userId);
}

function clearPlanOnboarding() {
    localStorage.removeItem(PLAN_ONBOARDING_KEY);
    isPlanOnboarding = false;
}

function isOnboardingUser(userId) {
    return !!userId && localStorage.getItem(PLAN_ONBOARDING_KEY) === userId;
}

function clearPlanPolling() {
    if (planPollTimer) {
        clearInterval(planPollTimer);
        planPollTimer = null;
    }
}

async function routeInitialView() {
    const session = await SupabaseClient.getSession();
    if (!session?.user?.id) {
        showWelcome();
        return;
    }

    const profile = await SupabaseClient.getProfile();
    if (isOnboardingUser(session.user.id)) {
        await showPlansView({ onboarding: true, profile });
        return;
    }
    await showDashboard(profile);
}

function hideAllViews() {
    ['welcome-view', 'auth-view', 'dashboard-view', 'plans-view', 'settings-view']
        .forEach(id => document.getElementById(id)?.classList.add('hidden'));
}

function showSettingsNav(show) {
    const navSettings = document.getElementById('nav-settings-btn');
    const navUser = document.getElementById('nav-user-profile');
    if (navSettings) navSettings.classList.toggle('hidden', !show);
    if (navUser) navUser.classList.toggle('hidden', !show);
}

function showWelcome() {
    clearPlanPolling();
    hideAllViews();
    showSettingsNav(false);
    document.getElementById('welcome-view').classList.remove('hidden');
}

function showAuthForm(mode) {
    clearPlanPolling();
    isLoginMode = mode === 'login';
    hideAllViews();
    showSettingsNav(false);
    document.getElementById('auth-view').classList.remove('hidden');
    updateAuthStrings();
}

function updateAuthStrings() {
    const dict = TRANSLATIONS[currentLang];
    const title = document.getElementById('auth-title');
    const toggle = document.getElementById('auth-toggle-btn');
    const submit = document.getElementById('auth-submit-btn');
    if (!title || !toggle || !submit) return;

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

async function hydrateUserUIFromSession() {
    const session = await SupabaseClient.getSession();
    if (!session?.user?.email) return;
    const rawUsername = session.user.email.split('@')[0];
    const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1);
    const userName = document.getElementById('user-name');
    const userAvatar = document.getElementById('user-avatar');
    if (userName) userName.textContent = username;
    if (userAvatar) userAvatar.textContent = username.charAt(0);
}

async function showDashboard(profile) {
    clearPlanPolling();
    isPlanOnboarding = false;
    hideAllViews();
    showSettingsNav(true);
    document.getElementById('dashboard-view').classList.remove('hidden');
    await hydrateUserUIFromSession();

    const resolvedProfile = profile || await SupabaseClient.getProfile();
    const currentPlan = normalizePlan(resolvedProfile?.plan);
    await updateQuota(resolvedProfile?.download_count || 0, currentPlan);
    setTag(TRANSLATIONS[currentLang][`plan_${currentPlan}`], true);
}

async function showPlansView({ onboarding = false, profile = null } = {}) {
    isPlanOnboarding = onboarding;
    hideAllViews();
    showSettingsNav(!onboarding);
    document.getElementById('plans-view').classList.remove('hidden');
    renderPlansHeader();
    await hydrateUserUIFromSession();
    renderPlansState(profile || await SupabaseClient.getProfile());
}

function showSettingsView() {
    clearPlanPolling();
    hideAllViews();
    showSettingsNav(true);
    document.getElementById('settings-view').classList.remove('hidden');
}

function setTag(text, active) {
    const el = document.getElementById('plan-tag');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('on', active);
}

function setPlansStatus(message, isError = false) {
    const status = document.getElementById('plans-status');
    if (!status) return;
    status.textContent = message || '';
    status.style.color = isError ? 'var(--primary)' : 'var(--text-muted)';
}

function setSettingsStatus(message, isError = false) {
    const status = document.getElementById('settings-status');
    if (!status) return;
    status.textContent = message || '';
    status.style.color = isError ? 'var(--primary)' : 'var(--text-muted)';
}

function renderPlansHeader() {
    const dict = TRANSLATIONS[currentLang];
    const subtitle = document.getElementById('plans-subtitle');
    const back = document.getElementById('plans-back-btn');
    if (subtitle) subtitle.textContent = isPlanOnboarding ? dict.plans_onboarding_subtitle : dict.plans_subtitle;
    if (back) back.classList.toggle('hidden', isPlanOnboarding);
}

function setPlanButtonState(button, text, disabled, mode = '') {
    if (!button) return;
    button.textContent = text;
    button.disabled = disabled;
    button.classList.toggle('is-current', mode === 'current');
    button.classList.toggle('is-secondary', mode === 'secondary');
}

function renderPlansState(profile) {
    const dict = TRANSLATIONS[currentLang];
    const currentPlan = normalizePlan(profile?.plan);

    const freeCard = document.getElementById('plan-card-free');
    const proCard = document.getElementById('plan-card-pro');
    const foreverCard = document.getElementById('plan-card-forever');

    freeCard?.classList.toggle('current', currentPlan === 'free');
    proCard?.classList.toggle('current', currentPlan === 'pro');
    foreverCard?.classList.toggle('current', currentPlan === 'forever');

    const freeBtn = document.getElementById('choose-free-btn');
    const proBtn = document.getElementById('buy-monthly-btn');
    const foreverBtn = document.getElementById('buy-lifetime-btn');

    if (isPlanOnboarding) {
        setPlanButtonState(freeBtn, dict.btn_continue_free, false, currentPlan === 'free' ? 'current' : '');
    } else if (currentPlan === 'free') {
        setPlanButtonState(freeBtn, dict.btn_current_plan, true, 'current');
    } else {
        setPlanButtonState(freeBtn, dict.btn_included, true, 'secondary');
    }

    if (currentPlan === 'pro') setPlanButtonState(proBtn, dict.btn_current_plan, true, 'current');
    else setPlanButtonState(proBtn, dict.btn_choose_pro, false, '');

    if (currentPlan === 'forever') setPlanButtonState(foreverBtn, dict.btn_current_plan, true, 'current');
    else setPlanButtonState(foreverBtn, dict.btn_choose_forever, false, '');
}

function getCheckoutConfig(targetPlan) {
    if (targetPlan === 'pro') return PLAN_MONTHLY;
    if (targetPlan === 'forever') return PLAN_LIFETIME;
    return null;
}

async function openCheckout(targetPlan) {
    const session = await SupabaseClient.getSession();
    if (!session?.user?.id) return;

    const planConfig = getCheckoutConfig(targetPlan);
    const planId = planConfig?.[ENV];
    if (!planId) {
        setPlansStatus(TRANSLATIONS[currentLang].checkout_unavailable, true);
        return;
    }

    const checkoutUrl = `${BASE_URL[ENV]}/${planId}/?metadata[supabase_user_id]=${session.user.id}`;
    window.open(checkoutUrl, '_blank');
    setPlansStatus(TRANSLATIONS[currentLang].plans_payment_pending);
    startPlanPolling(targetPlan);
}

function startPlanPolling(targetPlan) {
    clearPlanPolling();
    planPollTimer = setInterval(async () => {
        try {
            const profile = await SupabaseClient.getProfile();
            renderPlansState(profile);
            if (normalizePlan(profile?.plan) !== targetPlan) return;
            clearPlanOnboarding();
            clearPlanPolling();
            setPlansStatus(TRANSLATIONS[currentLang].plans_paid_ready);
            await showDashboard(profile);
        } catch {}
    }, 3000);
}

async function handlePlanSelection(plan) {
    if (plan === 'free') {
        try {
            await SupabaseClient.updatePlan('free');
        } catch {}
        clearPlanOnboarding();
        setPlansStatus(TRANSLATIONS[currentLang].plans_free_ready);
        await showDashboard();
        return;
    }

    if (plan === 'forever') setPlansStatus(TRANSLATIONS[currentLang].plans_waiting_forever);
    await openCheckout(plan);
}

function setupAuthListeners() {
    const btnLogin = document.getElementById('welcome-login-btn');
    const btnRegister = document.getElementById('welcome-register-btn');
    const btnToggle = document.getElementById('auth-toggle-btn');
    const btnBack = document.getElementById('auth-back-btn');
    const btnSubmit = document.getElementById('auth-submit-btn');
    const user = document.getElementById('auth-user');
    const pass = document.getElementById('auth-pass');
    const err = document.getElementById('auth-error');

    btnLogin.onclick = () => showAuthForm('login');
    btnRegister.onclick = () => showAuthForm('register');
    btnBack.onclick = () => showWelcome();

    document.getElementById('upgrade-btn')?.addEventListener('click', () => showPlansView({ onboarding: false }));
    document.getElementById('plans-back-btn')?.addEventListener('click', () => showDashboard());
    document.getElementById('choose-free-btn')?.addEventListener('click', () => handlePlanSelection('free'));
    document.getElementById('buy-monthly-btn')?.addEventListener('click', () => handlePlanSelection('pro'));
    document.getElementById('buy-lifetime-btn')?.addEventListener('click', () => handlePlanSelection('forever'));
    document.getElementById('nav-settings-btn')?.addEventListener('click', showSettingsView);
    document.getElementById('settings-back-btn')?.addEventListener('click', () => showDashboard());
    document.getElementById('settings-open-plans-btn')?.addEventListener('click', () => showPlansView({ onboarding: false }));

    btnToggle.onclick = () => {
        isLoginMode = !isLoginMode;
        updateAuthStrings();
        err.textContent = '';
    };

    btnSubmit.onclick = async () => {
        const dict = TRANSLATIONS[currentLang];
        const u = user.value.trim();
        const p = pass.value.trim();
        if (!u || !p) {
            err.textContent = dict.login_header;
            return;
        }
        if (p.length < 6) {
            err.textContent = dict.min_chars;
            return;
        }

        const email = `${u.toLowerCase().replace(/[^a-z0-9]/g, '')}@misil.app`;
        btnSubmit.disabled = true;
        btnSubmit.textContent = '...';
        err.textContent = '';

        try {
            if (isLoginMode) {
                await SupabaseClient.signIn(email, p);
                await routeInitialView();
            } else {
                await SupabaseClient.signUp(email, p);
                const session = await SupabaseClient.getSession();
                if (session?.user?.id) markPlanOnboarding(session.user.id);
                await showPlansView({ onboarding: true });
            }
        } catch (e) {
            err.textContent = e.message;
        } finally {
            btnSubmit.disabled = false;
            updateAuthStrings();
        }
    };

    document.getElementById('logout-btn').onclick = async () => {
        clearPlanOnboarding();
        clearPlanPolling();
        await SupabaseClient.signOut();
        showWelcome();
    };

    document.getElementById('settings-logout-btn')?.addEventListener('click', async () => {
        clearPlanOnboarding();
        clearPlanPolling();
        await SupabaseClient.signOut();
        showWelcome();
    });

    document.getElementById('settings-save-username-btn')?.addEventListener('click', async () => {
        const dict = TRANSLATIONS[currentLang];
        const value = document.getElementById('settings-username')?.value?.trim() || '';
        if (!value) return setSettingsStatus(dict.invalid_user, true);
        try {
            await SupabaseClient.updateUsername(value);
            await hydrateUserUIFromSession();
            setSettingsStatus(dict.save_success);
            document.getElementById('settings-username').value = '';
        } catch (e) {
            setSettingsStatus(e.message || dict.invalid_user, true);
        }
    });

    document.getElementById('settings-save-password-btn')?.addEventListener('click', async () => {
        const dict = TRANSLATIONS[currentLang];
        const value = document.getElementById('settings-password')?.value?.trim() || '';
        if (value.length < 6) return setSettingsStatus(dict.min_chars, true);
        try {
            await SupabaseClient.updatePassword(value);
            setSettingsStatus(dict.save_success);
            document.getElementById('settings-password').value = '';
        } catch (e) {
            setSettingsStatus(e.message || dict.min_chars, true);
        }
    });
}

async function updateQuota(count, plan) {
    const limit = 100;
    const dict = TRANSLATIONS[currentLang];

    const currentCount = document.getElementById('current-count');
    const remWrap = document.getElementById('remaining-wrap');
    const ringOf = document.getElementById('ring-of');
    const ring = document.getElementById('circle-fill');
    const promo = document.getElementById('premium-promo-box');
    const warning = document.getElementById('credits-warning');

    if (plan === 'pro' || plan === 'forever') {
        if (currentCount) currentCount.textContent = '∞';
        if (ringOf) ringOf.textContent = dict.remaining_unlimited;
        const activeKey = plan === 'forever' ? 'forever_active' : 'pro_active';
        if (remWrap) remWrap.innerHTML = `<span style="color:var(--primary); font-weight:700;">${dict[activeKey]}</span> - ${dict.remaining_unlimited}`;
        if (promo) promo.classList.add('hidden');
        if (warning) warning.classList.add('hidden');
        if (ring) {
            const r = 44;
            const circ = 2 * Math.PI * r;
            ring.style.strokeDasharray = circ;
            ring.style.strokeDashoffset = 0;
        }
        return;
    }

    const remaining = Math.max(0, limit - count);
    if (promo) promo.classList.remove('hidden');
    if (currentCount) currentCount.textContent = count;
    if (ringOf) ringOf.textContent = `${dict.ring_of} ${limit}`;
    if (remWrap) remWrap.innerHTML = `${dict.remaining_prefix} <strong id="remaining-count" style="color:var(--primary)">${remaining}</strong> ${dict.remaining_suffix}`;
    if (warning) warning.classList.toggle('hidden', remaining > 0);
    if (ring) {
        const r = 44;
        const circ = 2 * Math.PI * r;
        ring.style.strokeDasharray = circ;
        ring.style.strokeDashoffset = circ - (Math.min(count, limit) / limit) * circ;
    }
}

(function initParticles() {
    const c = document.getElementById('particles-bg');
    if (!c) return;
    const ctx = c.getContext('2d');
    let w;
    let h;
    const resize = () => { w = c.width = innerWidth; h = c.height = innerHeight; };
    resize();
    addEventListener('resize', resize);
    const pts = Array.from({ length: 40 }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.35 + 0.1
    }));
    (function draw() {
        ctx.clearRect(0, 0, w, h);
        pts.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,55,55,${p.a})`;
            ctx.fill();
        });
        requestAnimationFrame(draw);
    })();
})();
