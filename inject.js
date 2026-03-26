// inject.js — Misil v4.1 (Bug fixes: photo format detection, video blob: handling)
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

    // ── Download via <a download> in page context ──
    async function downloadBlob(url, filenameBase) {
        console.log('[Misil] URL tipo:', url.startsWith('blob:') ? 'BLOB-INTERNO' : 'HTTPS-OK');
        const r = await fetch(url, { credentials: 'include' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const blob = await r.blob();
        console.log('[Misil] Blob recibido:', blob.size, 'bytes, tipo:', blob.type);

        // Reject tiny images (thumbnails)
        if (blob.size < 80000 && blob.type && blob.type.startsWith('image')) {
            throw new Error('THUMBNAIL');
        }
        if (blob.size < 1000) {
            throw new Error('Archivo vacío o corrupto');
        }

        // Derive correct extension from actual MIME type
        const ext = extFromMime(blob.type, '.bin');
        const filename = filenameBase + ext;

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
        if (!v) v = document.querySelector('.media-viewer-whole, #MediaViewer');
        if (!v) return;
        const b = v.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
        if (b) b.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    }

    // ── Try to find a direct HTTPS video URL from the message DOM (before viewer) ──
    function findPreVideoUrl(media) {
        // Look for <video> or <source> with an https:// src inside the chat message
        const vid = media.querySelector('video');
        if (vid) {
            const s = vid.currentSrc || vid.src || '';
            if (s.startsWith('https://')) return s;
            // Check <source> children
            const source = vid.querySelector('source[src]');
            if (source && source.src && source.src.startsWith('https://')) return source.src;
        }
        return null;
    }

    // ── Wait for PHOTO in viewer ──
    function waitForPhoto() {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;
                const v = document.querySelector('.media-viewer-whole, #MediaViewer');
                if (!v) { if (t > 75) { clearInterval(iv); fail(new Error('viewer_timeout')); } return; }

                // Find the largest image in the viewer
                let best = null, bestA = 0;
                v.querySelectorAll('img').forEach(im => {
                    // Filter out ALL small images (thumbnails, icons, avatars)
                    if (im.naturalWidth < 300 || im.naturalHeight < 300) return;
                    const cn = im.className || '';
                    if (cn.includes('thumb') || cn.includes('avatar') || cn.includes('icon')) return;
                    const a = im.naturalWidth * im.naturalHeight;
                    if (a > bestA) { bestA = a; best = im; }
                });

                // Require naturalWidth > 600 for HD confirmation
                if (best && best.naturalWidth > 600) {
                    const s = best.src;
                    if (s && s.length > 10) {
                        if (s === last) stable++;
                        else { last = s; stable = 0; }

                        // Wait 8 ticks × 200ms = 1.6 seconds of stable src
                        if (stable >= 8) {
                            clearInterval(iv);
                            ok({ url: s, viewer: v });
                            return;
                        }
                    }
                }

                // Timeout after 15 seconds
                if (t > 75) {
                    clearInterval(iv);
                    fail(new Error('capture_timeout'));
                }
            }, 200);
        });
    }

    // ── Wait for VIDEO in viewer ──
    function waitForVideo(preUrl) {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;
                const v = document.querySelector('.media-viewer-whole, #MediaViewer');
                if (!v) { if (t > 60) { clearInterval(iv); fail(new Error('viewer_timeout')); } return; }

                // Strategy 1: Look for <video> with HTTPS src
                const vid = v.querySelector('video');
                if (vid) {
                    let s = vid.currentSrc || vid.src || '';

                    // If it's blob:, DON'T use it — skip to alternatives
                    if (s.startsWith('blob:')) {
                        s = ''; // discard blob URL
                    }

                    // Check <source> elements for https URL
                    if (!s) {
                        const source = vid.querySelector('source[src]');
                        if (source && source.src && source.src.startsWith('https://')) {
                            s = source.src;
                        }
                    }

                    // If still no HTTPS url, try preUrl (from chat DOM)
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

                // Timeout after 12 seconds (60 ticks × 200ms)
                if (t > 60) {
                    clearInterval(iv);
                    // Check if we only found blob: URLs
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

    // ── Main download flow ──
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

            // Step 2: For videos, try to grab HTTPS url from chat DOM BEFORE opening viewer
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
                // Close viewer on any capture error
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

            // Step 6: Fetch + download
            toast('Descargando…', 'info');
            try {
                const size = await downloadBlob(captured.url, filenameBase);
                const sizeMB = (size / (1024 * 1024)).toFixed(1);
                toast('✅ ¡Descargado! (' + sizeMB + ' MB)', 'success');
            } catch (dlErr) {
                if (dlErr.message === 'THUMBNAIL') {
                    // Thumbnail detected — retry logic could go here
                    toast('Se detectó miniatura en vez de archivo real. Intenta de nuevo.', 'error');
                    refundCredit();
                } else {
                    throw dlErr;
                }
            }

        } catch (err) {
            console.error('[Misil] Error en descarga:', err);
            toast('Error: ' + err.message, 'error');
            refundCredit();
        }
    }

    // ── DOM scan with MutationObserver ──
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

    console.log('[Misil] v4.1 loaded');
})();
