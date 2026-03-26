// inject.js — Misil v4.3 (Direct <a> for photos, Range-header chunked fetch for videos)
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

    // ══════════════════════════════════════════════════════════════
    // ── PHOTO DOWNLOAD: Direct <a href=src download> — no fetch ──
    // ══════════════════════════════════════════════════════════════
    function downloadImage(imgSrc, filenameBase) {
        console.log('[Misil] Foto: descarga directa via <a>:', imgSrc.substring(0, 80));
        const a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.href = imgSrc;
        a.download = filenameBase + '.jpg';
        a.click();
        document.body.removeChild(a);
    }

    // ══════════════════════════════════════════════════════════════════
    // ── VIDEO DOWNLOAD: Fetch with Range header in recursive chunks ──
    // ══════════════════════════════════════════════════════════════════
    async function downloadVideoChunked(url, filenameBase) {
        console.log('[Misil] Video: descarga chunked con Range header');
        console.log('[Misil] URL:', url.substring(0, 80));

        const blobs = [];
        let nextOffset = 0;
        let totalSize = null;
        const filename = filenameBase + '.mp4';

        async function fetchChunk() {
            console.log('[Misil] Fetching chunk desde offset:', nextOffset);
            const r = await fetch(url, {
                method: 'GET',
                headers: { 'Range': 'bytes=' + nextOffset + '-' }
            });

            if (![200, 206].includes(r.status)) {
                throw new Error('HTTP ' + r.status + ' en chunk');
            }

            const contentType = (r.headers.get('content-type') || '').split(';')[0].trim();
            console.log('[Misil] Chunk status:', r.status, 'content-type:', contentType);

            if (contentType.includes('text/html')) {
                throw new Error('Respuesta HTML: servidor redirigió a login');
            }

            const rangeHeader = r.headers.get('content-range');
            if (rangeHeader) {
                // Format: "bytes START-END/TOTAL"
                const match = rangeHeader.match(/^bytes\s+(\d+)-(\d+)\/(\d+)$/);
                if (match) {
                    nextOffset = parseInt(match[2]) + 1;
                    totalSize = parseInt(match[3]);
                    console.log('[Misil] Content-Range:', rangeHeader, '→ next:', nextOffset, '/ total:', totalSize);
                }
            } else {
                // HTTP 200: server sent entire file in one response
                const blob = await r.blob();
                totalSize = blob.size;
                nextOffset = totalSize;
                blobs.push(blob);
                console.log('[Misil] Respuesta completa (200), tamaño:', blob.size);
                return;
            }

            const blob = await r.blob();
            blobs.push(blob);

            const pct = totalSize ? Math.round((nextOffset / totalSize) * 100) : 0;
            toast('Descargando… ' + pct + '%', 'info');

            if (nextOffset < totalSize) {
                await fetchChunk();
            }
        }

        await fetchChunk();

        const finalBlob = new Blob(blobs, { type: 'video/mp4' });
        console.log('[Misil] Video completo:', finalBlob.size, 'bytes (' + blobs.length + ' chunks)');

        const u = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = u;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(u); }, 15000);
        return finalBlob.size;
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
                            ok({ url: s, viewer: v });
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
            if (!isVid) {
                // ── PHOTO: Direct <a href=src download> ──
                try {
                    toast('Descargando foto…', 'info');
                    downloadImage(captured.url, filenameBase);
                    toast('✅ ¡Foto descargada!', 'success');
                } catch (imgErr) {
                    console.error('[Misil] Foto download falló:', imgErr);
                    toast('Error: ' + imgErr.message, 'error');
                    refundCredit();
                }
            } else {
                // ── VIDEO: Chunked fetch with Range header ──
                try {
                    toast('Descargando video…', 'info');
                    const size = await downloadVideoChunked(captured.url, filenameBase);
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

    console.log('[Misil] v4.3 loaded');
})();
