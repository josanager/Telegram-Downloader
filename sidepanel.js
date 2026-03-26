// sidepanel.js – Misil v3.0 (Simple - only login/account)

let isLoginMode = true;

document.addEventListener('DOMContentLoaded', async () => {
    const session = await SupabaseClient.getSession();
    if (session) showDashboard();
    else showAuth();

    setupAuthListeners();
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
            updateQuota(profile.download_count || 0);
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
    const el = document.getElementById('current-count');
    const rem = document.getElementById('remaining-count');
    const circle = document.getElementById('circle-fill');
    if (el) el.textContent = count;
    if (rem) rem.textContent = Math.max(0, limit - count);
    if (circle) {
        const radius = 34;
        const offset = (2 * Math.PI * radius) - (count / limit) * (2 * Math.PI * radius);
        circle.style.strokeDashoffset = offset;
    }
}

// ── PARTICLES ──
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
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            r: Math.random() * 2.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.3,
            dy: (Math.random() - 0.5) * 0.3,
            alpha: Math.random() * 0.4 + 0.1
        });
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.dx; p.y += p.dy;
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 55, 55, ' + p.alpha + ')';
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}
initParticles();
