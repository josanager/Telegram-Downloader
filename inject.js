// inject.js — Misil v4.2 (Canvas extraction for photos, multi-fetch for videos)
// MAIN world: detect, capture, download in page context.
// NEVER sends binary data through messaging.

(function () {
    const tag = document.currentScript;
    if (!tag) return;
    const NONCE = tag.dataset.nonce;
    const ICON = tag.dataset.iconUrl;
    const ORIGIN = location.origin;
    const CH = 'misil';
    if (!NONCE || !ICON) return;

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

    // ── Refund helper ──
    function refundCredit() {
        send('refund-credit');
    }

    // ── Derive file extension from blob MIME type ──
    function extFromMime(mime, fallback) {
        if (!mime) return fallback;
        const m = mime.toLowerCase();
        if (m.includes('webp'))  return '.webp';
        if (m.includes('png'))   return '.png';
        if (m.includes('avif'))  return '.avif';
        if (m.includes('gif'))   return '.gif';
        if (m.includes('jpeg') || m.includes('jpg')) return '.jpg';
        if (m.includes('mp4'))   return '.mp4';
        if (m.includes('webm'))  return '.webm';
        if (m.includes('ogg'))   return '.ogg';
        return fallback;
    }

    // ══════════════════════════════════════════════════════════
    // ── PHOTO DOWNLOAD: Canvas extraction (no fetch needed) ──
    // ══════════════════════════════════════════════════════════
    async function downloadFromImg(imgElement, filenameBase) {
        if (!imgElement.complete || imgElement.naturalWidth === 0) {
            throw new Error('Imagen no cargada en memoria');
        }
        console.log('[Misil] Canvas extraction:', imgElement.naturalWidth, 'x', imgElement.naturalHeight);

        const canvas = document.createElement('canvas');
        canvas.width = imgElement.naturalWidth;
        canvas.height = imgElement.naturalHeight;
        const ctx = canvas.getContext('2d');

        try {
            ctx.drawImage(imgElement, 0, 0);
        } catch (e) {
            console.error('[Misil] drawImage failed:', e);
            throw new Error('CANVAS_TAINTED');
        }

        // Check for tainted canvas (cross-origin without CORS headers)
        try {
            canvas.toDataURL(); // This throws if tainted
        } catch (e) {
            console.error('[Misil] Canvas tainted (cross-origin):', e);
            throw new Error('CANVAS_TAINTED');
        }

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                if (!blob || blob.size < 10000) {
                    reject(new Error('THUMBNAIL'));
                    return;
                }
                console.log('[Misil] Canvas blob:', blob.size, 'bytes, tipo:', blob.type);
                const filename = filenameBase + '.jpg';
                const u = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = u;
                a.download = filename;
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 15000);
                resolve(blob.size);
            }, 'image/jpeg', 0.95);
        });
    }

    // ══════════════════════════════════════════════════════════
    // ── VIDEO DOWNLOAD: Multi-fetch with HTML redirect detect ─
    // ══════════════════════════════════════════════════════════
    async function downloadBlob(url, filenameBase) {
        console.log('[Misil] URL tipo:', url.startsWith('blob:') ? 'BLOB-INTERNO' : 'HTTPS-OK');
        console.log('[Misil] Intentando URL:', url.substring(0, 80));

        // Helper: try a fetch, return null if response is HTML (login redirect)
        async function tryFetch(fetchUrl, opts) {
            try {
                const r = await fetch(fetchUrl, opts);
                const ct = r.headers.get('content-type') || '';
                console.log('[Misil] tryFetch status:', r.status, 'content-type:', ct);
                if (ct.includes('text/html')) {
                    console.warn('[Misil] Respuesta HTML detectada (login redirect), descartando');
                    return null;
                }
                if (!r.ok) {
                    console.warn('[Misil] Respuesta HTTP no-ok:', r.status);
                    return null;
                }
                return r;
            } catch (err) {
                console.warn('[Misil] Fetch error:', err.message);
                return null;
            }
        }

        let r = null;

        // Intento 1: con cookies de sesión de web.telegram.org
        console.log('[Misil] Intento 1: fetch con cookies (credentials: include)');
        r = await tryFetch(url, { credentials: 'include', redirect: 'follow' });

        // Intento 2: sin cookies (para CDN público que no requiere auth)
        if (!r) {
            console.log('[Misil] Intento 2: fetch sin cookies (credentials: omit)');
            r = await tryFetch(url, { credentials: 'omit', redirect: 'follow' });
        }

        // Intento 3: sin seguir redirects, intentar capturar Location header
        if (!r) {
            console.log('[Misil] Intento 3: redirect manual para capturar Location');
            try {
                const rRaw = await fetch(url, { credentials: 'omit', redirect: 'manual' });
                console.log('[Misil] Redirect manual status:', rRaw.status, 'type:', rRaw.type);
                const redirectUrl = rRaw.headers.get('location');
                if (redirectUrl && redirectUrl.startsWith('https://')) {
                    console.log('[Misil] Location header encontrado:', redirectUrl.substring(0, 80));
                    r = await tryFetch(redirectUrl, { credentials: 'omit', redirect: 'follow' });
                } else {
                    console.warn('[Misil] Location header no accesible (CORS opaco) o vacío');
                }
            } catch (err) {
                console.warn('[Misil] Intento 3 falló:', err.message);
            }
        }

        // All attempts failed
        if (!r) {
            throw new Error('URL protegida: todos los intentos fallaron (HTTP 302 sin acceso)');
        }

        const blob = await r.blob();
        console.log('[Misil] Blob recibido:', blob.size, 'bytes, tipo:', blob.type);

        if (!blob || blob.size < 1000) {
            throw new Error('Archivo vacío o corrupto');
        }
        if (blob.type && blob.type.includes('text/html')) {
            throw new Error('Respuesta HTML en blob: URL expirada o protegida');
        }

        const ext = extFromMime(blob.type, '.mp4');
        const filename = filenameBase + ext;

        const u = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = u;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 15000);
        return blob.size;
    }

    // ══════════════════════════════════════════
    // ── Viewer helpers ──
    // ══════════════════════════════════════════
    function closeViewer(v) {
        if (!v) v = document.querySelector('.media-viewer-whole, #MediaViewer');
        if (!v) return;
        const b = v.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
        if (b) b.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    }

    // ── Try to find a direct HTTPS video URL from the message DOM (before viewer) ──
    function findPreVideoUrl(media) {
        const vid = media.querySelector('video');
        if (vid) {
            const s = vid.currentSrc || vid.src || '';
            if (s.startsWith('https://')) return s;
            const source = vid.querySelector('source[src]');
            if (source && source.src && source.src.startsWith('https://')) return source.src;
        }
        return null;
    }

    // ══════════════════════════════════════════
    // ── Wait for PHOTO in viewer ──
    // ══════════════════════════════════════════
    function waitForPhoto() {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;
                const v = document.querySelector('.media-viewer-whole, #MediaViewer');
                if (!v) { if (t > 75) { clearInterval(iv); fail(new Error('viewer_timeout')); } return; }

                let best = null, bestA = 0;
                v.querySelectorAll('img').forEach(im => {
                    if (im.naturalWidth < 300 || im.naturalHeight < 300) return;
                    const cn = im.className || '';
                    if (cn.includes('thumb') || cn.includes('avatar') || cn.includes('icon')) return;
                    const a = im.naturalWidth * im.naturalHeight;
                    if (a > bestA) { bestA = a; best = im; }
                });

                if (best && best.naturalWidth > 600) {
                    const s = best.src;
                    if (s && s.length > 10) {
                        if (s === last) stable++;
                        else { last = s; stable = 0; }
                        // 8 ticks × 200ms = 1.6s stable
                        if (stable >= 8) {
                            clearInterval(iv);
                            // Return the img element for canvas extraction
                            ok({ url: s, viewer: v, imgElement: best });
                            return;
                        }
                    }
                }

                if (t > 75) { clearInterval(iv); fail(new Error('capture_timeout')); }
            }, 200);
        });
    }

    // ══════════════════════════════════════════
    // ── Wait for VIDEO in viewer ──
    // ══════════════════════════════════════════
    function waitForVideo(preUrl) {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;
                const v = document.querySelector('.media-viewer-whole, #MediaViewer');
                if (!v) { if (t > 60) { clearInterval(iv); fail(new Error('viewer_timeout')); } return; }

                const vid = v.querySelector('video');
                if (vid) {
                    let s = vid.currentSrc || vid.src || '';

                    // If blob: URL, DON'T use it directly
                    if (s.startsWith('blob:')) {
                        s = '';
                    }

                    // Check <source> elements
                    if (!s) {
                        const source = vid.querySelector('source[src]');
                        if (source && source.src && source.src.startsWith('https://')) {
                            s = source.src;
                        }
                    }

                    // Fallback to pre-captured URL from chat DOM
                    if (!s && preUrl) {
                        s = preUrl;
                    }

                    if (s && s.startsWith('https://') && s.length > 10) {
                        if (s === last) stable++;
                        else { last = s; stable = 0; }
                        if (stable >= 5) {
                            clearInterval(iv);
                            ok({ url: s, viewer: v });
                            return;
                        }
                    }
                }

                // 60 ticks × 200ms = 12 seconds
                if (t > 60) {
                    clearInterval(iv);
                    const finalVid = v.querySelector('video');
                    const finalSrc = finalVid ? (finalVid.currentSrc || finalVid.src || '') : '';
                    if (finalSrc.startsWith('blob:')) {
                        fail(new Error('blob_protected'));
                    } else {
                        fail(new Error('video_timeout'));
                    }
                }
            }, 200);
        });
    }

    // ══════════════════════════════════════════════════
    // ── Main download flow ──
    // ══════════════════════════════════════════════════
    async function handleClick(media, isVid) {
        const prefix = isVid ? 'video' : 'foto';
        const filenameBase = 'telegram_' + prefix + '_' + Date.now();

        try {
            // Step 1: Consume quota credit
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

            // Step 2: Pre-capture video URL from chat DOM
            let preVideoUrl = null;
            if (isVid) {
                preVideoUrl = findPreVideoUrl(media);
                if (preVideoUrl) {
                    console.log('[Misil] Pre-captured video URL from DOM:', preVideoUrl.substring(0, 60));
                }
            }

            // Step 3: Open viewer
            toast('Procesando…', 'info');
            const target = media.querySelector('img.full-media, video, img, .full-media') || media;
            target.click();

            // Step 4: Wait for media in viewer
            let captured;
            try {
                if (isVid) {
                    captured = await waitForVideo(preVideoUrl);
                } else {
                    captured = await waitForPhoto();
                }
            } catch (err) {
                closeViewer(null);
                if (err.message === 'blob_protected') {
                    toast('No se pudo obtener la URL del video. Telegram lo protege con streaming interno.', 'error');
                } else {
                    toast('No se encontró URL descargable', 'error');
                }
                refundCredit();
                return;
            }

            // Step 5: Close viewer FIRST, then download in background
            closeViewer(captured.viewer);
            await new Promise(r => setTimeout(r, 500));

            // Step 6: Download
            toast('Descargando…', 'info');

            if (!isVid) {
                // ── PHOTO: Canvas extraction (primary), fetch as fallback ──
                try {
                    console.log('[Misil] Foto: intentando canvas extraction');
                    const size = await downloadFromImg(captured.imgElement, filenameBase);
                    const sizeMB = (size / (1024 * 1024)).toFixed(1);
                    toast('✅ ¡Foto descargada! (' + sizeMB + ' MB)', 'success');
                } catch (canvasErr) {
                    if (canvasErr.message === 'THUMBNAIL') {
                        console.warn('[Misil] Canvas produjo thumbnail, descartando');
                        toast('Se detectó miniatura en vez de archivo real. Intenta de nuevo.', 'error');
                        refundCredit();
                        return;
                    }
                    if (canvasErr.message === 'CANVAS_TAINTED') {
                        console.warn('[Misil] Canvas tainted, intentando fetch como fallback');
                        try {
                            const size = await downloadBlob(captured.url, filenameBase);
                            const sizeMB = (size / (1024 * 1024)).toFixed(1);
                            toast('✅ ¡Foto descargada! (' + sizeMB + ' MB)', 'success');
                        } catch (fetchErr) {
                            console.error('[Misil] Foto: fetch fallback también falló:', fetchErr);
                            toast('Error: ' + fetchErr.message, 'error');
                            refundCredit();
                        }
                        return;
                    }
                    // Any other canvas error
                    console.error('[Misil] Canvas error inesperado:', canvasErr);
                    toast('Error: ' + canvasErr.message, 'error');
                    refundCredit();
                }

            } else {
                // ── VIDEO: Multi-attempt fetch ──
                try {
                    console.log('[Misil] Video: intentando multi-fetch');
                    const size = await downloadBlob(captured.url, filenameBase);
                    const sizeMB = (size / (1024 * 1024)).toFixed(1);
                    toast('✅ ¡Video descargado! (' + sizeMB + ' MB)', 'success');
                } catch (dlErr) {
                    console.error('[Misil] Video download falló:', dlErr);
                    toast('Error: ' + dlErr.message, 'error');
                    refundCredit();
                }
            }

        } catch (err) {
            console.error('[Misil] Error general en descarga:', err);
            toast('Error: ' + err.message, 'error');
            refundCredit();
        }
    }

    // ══════════════════════════════════════════
    // ── DOM scan with MutationObserver ──
    // ══════════════════════════════════════════
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

    console.log('[Misil] v4.2 loaded');
})();
