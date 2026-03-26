// inject.js — Misil v4.0 (MAIN world: detect, capture, download in page context)
// NEVER sends binary data through messaging. Downloads via <a download>.

(function () {
    const tag = document.currentScript;
    if (!tag) return;
    const NONCE = tag.dataset.nonce;
    const ICON = tag.dataset.iconUrl;
    const ORIGIN = location.origin;
    const CH = 'misil';
    if (!NONCE || !ICON) return;

    // ── Logging ──
    const DEV = false;
    const log = (...a) => DEV && console.log('[Misil]', ...a);

    // ── Toast overlay ──
    function toast(text, type) {
        let el = document.getElementById('misil-toast');
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'misil-toast';
        el.textContent = text;
        const bg = { info: 'rgba(30,39,64,.92)', success: 'rgba(34,197,94,.18)', error: 'rgba(239,68,68,.18)' };
        const fg = { info: '#f1f5f9', success: '#22c55e', error: '#ef4444' };
        const bd = { info: 'rgba(255,55,55,.3)', success: 'rgba(34,197,94,.4)', error: 'rgba(239,68,68,.4)' };
        Object.assign(el.style, {
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            padding: '10px 22px', borderRadius: '10px', fontSize: '13px', fontWeight: '500',
            fontFamily: 'Inter,system-ui,sans-serif', zIndex: '2147483647', pointerEvents: 'none',
            background: bg[type] || bg.info, color: fg[type] || fg.info,
            border: '1px solid ' + (bd[type] || bd.info), opacity: '0', transition: 'opacity .25s'
        });
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
    }

    // ── Messaging helpers ──
    function send(action, extra) {
        window.postMessage({ channel: CH, nonce: NONCE, action, ...extra }, ORIGIN);
    }

    function waitFor(action, ms) {
        return new Promise((ok, fail) => {
            const timer = setTimeout(() => { window.removeEventListener('message', fn); fail(new Error('timeout')); }, ms);
            function fn(e) {
                if (e.source !== window || e.origin !== ORIGIN) return;
                const d = e.data;
                if (!d || d.channel !== CH || d.nonce !== NONCE || d.action !== action) return;
                clearTimeout(timer);
                window.removeEventListener('message', fn);
                ok(d.data);
            }
            window.addEventListener('message', fn);
        });
    }

    // ── Download via <a download> in page context — no messaging of blobs ──
    async function downloadBlob(url, filename) {
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        if (blob.size < 1000) throw new Error('Archivo vacío o corrupto');
        log('Blob ready:', blob.size, 'bytes');
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 15000);
        return blob.size;
    }

    // ── Viewer helpers ──
    function closeViewer(v) {
        const b = v.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
        if (b) b.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    }

    function waitForMedia(isVid) {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;
                const v = document.querySelector('.media-viewer-whole, #MediaViewer');
                if (!v) { if (t > 75) { clearInterval(iv); fail(new Error('viewer_timeout')); } return; }

                if (isVid) {
                    const el = v.querySelector('video');
                    if (el) {
                        const s = el.currentSrc || el.src || '';
                        if (s.length > 10 && s !== 'about:blank') {
                            if (s === last) stable++; else { last = s; stable = 0; }
                            if (el.readyState >= 2 || stable >= 10) {
                                clearInterval(iv); closeViewer(v); ok({ url: s, kind: 'video' }); return;
                            }
                        }
                    }
                } else {
                    let best = null, bestA = 0;
                    v.querySelectorAll('img').forEach(im => {
                        if (im.naturalWidth < 100 || im.naturalHeight < 100) return;
                        const cn = im.className || '';
                        if (cn.includes('thumb') || cn.includes('avatar')) return;
                        const a = im.naturalWidth * im.naturalHeight;
                        if (a > bestA) { bestA = a; best = im; }
                    });
                    if (best && best.naturalWidth > 400) {
                        const s = best.src;
                        if (s && s.length > 10) {
                            if (s === last) stable++; else { last = s; stable = 0; }
                            if (stable >= 5) {
                                clearInterval(iv); closeViewer(v); ok({ url: s, kind: 'photo' }); return;
                            }
                        }
                    }
                }
                if (t > 75) { clearInterval(iv); const v2 = document.querySelector('.media-viewer-whole'); if (v2) closeViewer(v2); fail(new Error('capture_timeout')); }
            }, 200);
        });
    }

    // ── Main flow: click → quota → viewer → fetch → <a download> ──
    async function handleClick(media, isVid) {
        const ext = isVid ? '.mp4' : '.jpg';
        const fname = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

        try {
            // 1. Consume quota credit
            toast('Verificando…', 'info');
            send('consume-credit');
            let quota;
            try { quota = await waitFor('consume-result', 8000); }
            catch { quota = { allowed: true }; } // offline fallback

            if (!quota.allowed) {
                const msgs = {
                    not_authenticated: 'Inicia sesión para descargar',
                    quota_exceeded: 'Cuota agotada este mes',
                    profile_not_found: 'Perfil no encontrado',
                    supabase_unavailable: 'Servidor no disponible, intenta luego'
                };
                toast(msgs[quota.error] || 'Error de cuota', 'error');
                if (quota.error === 'not_authenticated') send('open-login');
                return;
            }

            // 2. Open viewer & capture HD URL
            toast('Procesando…', 'info');
            const target = media.querySelector('img.full-media, video, img, .full-media') || media;
            target.click();

            let cap;
            try { cap = await waitForMedia(isVid); }
            catch {
                toast('No se encontró URL descargable', 'error');
                send('refund-credit');
                return;
            }

            // 3. Wait for viewer close animation
            await new Promise(r => setTimeout(r, 600));

            // 4. Fetch + download in page context
            toast('Descargando…', 'info');
            const realName = cap.kind === 'video' ? fname.replace(/\.jpg$/, '.mp4') : fname.replace(/\.mp4$/, '.jpg');
            await downloadBlob(cap.url, realName);
            toast('✅ ¡Descargado!', 'success');

        } catch (err) {
            console.error('[Misil]', err);
            toast('Error: ' + err.message, 'error');
            send('refund-credit');
        }
    }

    // ── DOM scan with MutationObserver (replaces setInterval) ──
    const SEL = '.media-inner, .album-item, .media-photo';
    const VID_SIG = 'video, .video-time, .media-video-time, .icon-large-play, .icon-play';

    function scan() {
        document.querySelectorAll(SEL).forEach(m => {
            if (m.dataset.misil) return;
            const isV = !!m.querySelector(VID_SIG);
            const isI = !isV && !!m.querySelector('img');
            if (!isV && !isI) return;
            m.dataset.misil = '1';
            if (getComputedStyle(m).position === 'static') m.style.position = 'relative';

            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.innerHTML = '<div class="tmd-dl-hitarea"></div><img class="tmd-dl-icon" src="' + ICON + '" draggable="false" alt="Misil">';
            btn.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);
                handleClick(m, isV);
            }, true);
            m.appendChild(btn);
        });
    }

    scan();
    let debounce = null;
    new MutationObserver(() => {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(scan, 300);
    }).observe(document.body, { childList: true, subtree: true });

    log('v4.0 loaded');
})();
