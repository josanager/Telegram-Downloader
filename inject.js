// inject.js — Misil v4.4 (Architecture ported from Neet-Nestor/Telegram-Media-Downloader)
// MAIN world: detect media, download in page context.
// Key discovery: Telegram serves content on Range requests (HTTP 206) even when
// normal GET redirects to CDN login page. For images, the viewer img.src is directly
// downloadable via <a download>. NEVER sends binary data through messaging.

(function () {
    const tag = document.currentScript;
    if (!tag) return;
    const NONCE = tag.dataset.nonce;
    const ICON = tag.dataset.iconUrl;
    const ORIGIN = location.origin;
    const CH = 'misil';
    if (!NONCE || !ICON) return;

    const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;

    // ── Toast overlay ──
    function toast(text, type) {
        let el = document.getElementById('misil-toast');
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'misil-toast';
        el.textContent = text;
        // Info (processing) is dark bg with red text. Success/Error are red bg with white text. No translucency.
        const bg = { info: 'rgb(30,39,64)', success: 'rgb(255,55,55)', error: 'rgb(255,55,55)' };
        const fg = { info: 'rgb(255,55,55)', success: '#ffffff', error: '#ffffff' };
        const bd = { info: 'rgb(255,55,55)', success: '#ffffff', error: '#ffffff' };
        Object.assign(el.style, {
            position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
            padding: '12px 24px', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
            fontFamily: 'Inter,system-ui,sans-serif', zIndex: '2147483647', pointerEvents: 'none',
            background: bg[type] || bg.info, color: fg[type] || fg.info,
            border: '2px solid ' + (bd[type] || bd.info), opacity: '0', transition: 'opacity .25s',
            boxShadow: '0 8px 16px rgba(0,0,0,0.3)'
        });
        document.body.appendChild(el);
        requestAnimationFrame(() => { el.style.opacity = '1'; });
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 4000);
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

    function refundCredit() {
        send('refund-credit');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── PHOTO DOWNLOAD — Direct anchor click (same as tel_download_image) ──
    // ══════════════════════════════════════════════════════════════════════════
    function tel_download_image(imageUrl, filenameBase) {
        console.log('[Misil] tel_download_image:', imageUrl.substring(0, 80));
        const fileName = filenameBase + '.jpeg';
        const a = document.createElement('a');
        a.style.display = 'none';
        document.body.appendChild(a);
        a.addEventListener('click', e => e.stopPropagation());
        a.href = imageUrl;
        a.download = fileName;
        a.click();
        document.body.removeChild(a);
        console.log('[Misil] Image download triggered:', fileName);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ── VIDEO DOWNLOAD — Range-header chunked fetch (from tel_download_video)
    // ══════════════════════════════════════════════════════════════════════════
    function tel_download_video(url, filenameBase) {
        return new Promise((resolve, reject) => {
            let _blobs = [];
            let _next_offset = 0;
            let _total_size = null;
            let _file_extension = 'mp4';
            let fileName = filenameBase + '.' + _file_extension;

            // Try to extract fileName from Telegram's stream URL metadata
            try {
                const parts = url.split('/');
                const metadata = JSON.parse(decodeURIComponent(parts[parts.length - 1]));
                if (metadata.fileName) {
                    fileName = metadata.fileName;
                }
            } catch (e) {
                // Not a metadata URL, use default fileName
            }

            console.log('[Misil] tel_download_video start:', url.substring(0, 80));
            console.log('[Misil] fileName:', fileName);

            const fetchNextPart = () => {
                fetch(url, {
                    method: 'GET',
                    headers: {
                        'Range': 'bytes=' + _next_offset + '-'
                    }
                })
                .then(res => {
                    if (![200, 206].includes(res.status)) {
                        throw new Error('HTTP ' + res.status + ' — no es 200/206');
                    }

                    const mime = (res.headers.get('Content-Type') || 'video/mp4').split(';')[0];
                    console.log('[Misil] Chunk response:', res.status, 'MIME:', mime);

                    if (mime.startsWith('text/html')) {
                        throw new Error('Servidor devolvió HTML en vez de video (redirect a login)');
                    }

                    // Update file extension from actual MIME
                    if (mime.startsWith('video/') || mime.startsWith('audio/')) {
                        _file_extension = mime.split('/')[1];
                        const dotIdx = fileName.lastIndexOf('.');
                        if (dotIdx > 0) {
                            fileName = fileName.substring(0, dotIdx + 1) + _file_extension;
                        }
                    }

                    const rangeHeader = res.headers.get('Content-Range');
                    if (rangeHeader) {
                        const match = rangeHeader.match(contentRangeRegex);
                        if (match) {
                            const startOffset = parseInt(match[1]);
                            const endOffset = parseInt(match[2]);
                            const totalSize = parseInt(match[3]);

                            if (startOffset !== _next_offset) {
                                console.error('[Misil] Gap detected! Expected:', _next_offset, 'Got:', startOffset);
                                throw new Error('Gap en la respuesta del servidor');
                            }
                            if (_total_size && totalSize !== _total_size) {
                                throw new Error('Tamaño total cambió durante descarga');
                            }

                            _next_offset = endOffset + 1;
                            _total_size = totalSize;

                            console.log('[Misil] Range:', rangeHeader,
                                '→ progreso:', Math.round((_next_offset * 100) / _total_size) + '%');
                        }
                    } else {
                        // HTTP 200: single response, no chunking
                        console.log('[Misil] Respuesta completa (HTTP 200, sin Content-Range)');
                    }

                    return res.blob();
                })
                .then(resBlob => {
                    _blobs.push(resBlob);

                    // If no Content-Range was received, we got everything in one shot
                    if (!_total_size) {
                        _total_size = resBlob.size;
                        _next_offset = _total_size;
                    }

                    const pct = Math.round((_next_offset * 100) / _total_size);
                    toast('Procesando… ' + pct + '%', 'info');

                    if (_next_offset < _total_size) {
                        fetchNextPart(); // Recursive: get next chunk
                    } else {
                        // All chunks received — concatenate and download
                        save();
                    }
                })
                .catch(err => {
                    console.error('[Misil] Chunk fetch error:', err);
                    reject(err);
                });
            };

            const save = () => {
                console.log('[Misil] Concatenando', _blobs.length, 'chunks...');
                const blob = new Blob(_blobs, { type: 'video/' + _file_extension });
                const blobUrl = URL.createObjectURL(blob);
                console.log('[Misil] Blob final:', blob.size, 'bytes');

                const a = document.createElement('a');
                a.style.display = 'none';
                document.body.appendChild(a);
                a.addEventListener('click', e => e.stopPropagation());
                a.href = blobUrl;
                a.download = fileName;
                a.click();
                document.body.removeChild(a);

                setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
                console.log('[Misil] Video download triggered:', fileName);
                resolve(blob.size);
            };

            // Start fetching
            fetchNextPart();
        });
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

    function findPreVideoUrl(media) {
        const vid = media.querySelector('video');
        if (vid) {
            const s = vid.currentSrc || vid.src || '';
            if (s.length > 10 && !s.startsWith('blob:')) return s;
            const source = vid.querySelector('source[src]');
            if (source && source.src && !source.src.startsWith('blob:')) return source.src;
        }
        return null;
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Wait for PHOTO in viewer (same as reference: detect img in viewer)
    // ══════════════════════════════════════════════════════════════════════
    function waitForPhoto() {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;

                // Strategy A: /a/ webapp — #MediaViewer
                const mediaViewerA = document.querySelector('#MediaViewer .MediaViewerSlide--active');
                if (mediaViewerA) {
                    const img = mediaViewerA.querySelector('.MediaViewerContent > div > img');
                    if (img && img.src && img.src.length > 10) {
                        if (img.src === last) stable++;
                        else { last = img.src; stable = 0; }
                        if (stable >= 5) {
                            clearInterval(iv);
                            const viewer = document.querySelector('#MediaViewer');
                            ok({ url: img.src, viewer: viewer });
                            return;
                        }
                    }
                }

                // Strategy B: /k/ webapp — .media-viewer-whole
                const mediaViewerK = document.querySelector('.media-viewer-whole');
                if (mediaViewerK) {
                    const aspecter = mediaViewerK.querySelector('.media-viewer-movers .media-viewer-aspecter');
                    if (aspecter) {
                        // Reference script uses img.thumbnail for /k/
                        const img = aspecter.querySelector('img.thumbnail') || aspecter.querySelector('img');
                        if (img && img.src && img.src.length > 10) {
                            if (img.src === last) stable++;
                            else { last = img.src; stable = 0; }
                            if (stable >= 5) {
                                clearInterval(iv);
                                ok({ url: img.src, viewer: mediaViewerK });
                                return;
                            }
                        }
                    }
                }

                if (t > 75) { clearInterval(iv); fail(new Error('viewer_timeout')); }
            }, 200);
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    // ── Wait for VIDEO in viewer (get video.currentSrc or video.src)
    // ══════════════════════════════════════════════════════════════════════
    function waitForVideo(preUrl) {
        return new Promise((ok, fail) => {
            let t = 0, last = '', stable = 0;
            const iv = setInterval(() => {
                t++;

                // Strategy A: /a/ webapp — #MediaViewer
                const mediaViewerA = document.querySelector('#MediaViewer .MediaViewerSlide--active');
                if (mediaViewerA) {
                    const videoPlayer = mediaViewerA.querySelector('.MediaViewerContent > .VideoPlayer');
                    if (videoPlayer) {
                        const vid = videoPlayer.querySelector('video');
                        if (vid) {
                            let s = vid.currentSrc || vid.src || '';
                            // Reference script uses currentSrc directly (even blob:)
                            if (s.length > 10) {
                                if (s === last) stable++;
                                else { last = s; stable = 0; }
                                if (stable >= 5) {
                                    clearInterval(iv);
                                    const viewer = document.querySelector('#MediaViewer');
                                    ok({ url: s, viewer: viewer });
                                    return;
                                }
                            }
                        }
                    }
                }

                // Strategy B: /k/ webapp — .media-viewer-whole
                const mediaViewerK = document.querySelector('.media-viewer-whole');
                if (mediaViewerK) {
                    const aspecter = mediaViewerK.querySelector('.media-viewer-movers .media-viewer-aspecter');
                    if (aspecter) {
                        const vid = aspecter.querySelector('video');
                        if (vid) {
                            let s = vid.currentSrc || vid.src || '';
                            if (s.length > 10) {
                                if (s === last) stable++;
                                else { last = s; stable = 0; }
                                if (stable >= 5) {
                                    clearInterval(iv);
                                    ok({ url: s, viewer: mediaViewerK });
                                    return;
                                }
                            }
                        }
                    }
                }

                // Fallback to pre-captured URL
                if (!last && preUrl && t > 20) {
                    clearInterval(iv);
                    ok({ url: preUrl, viewer: document.querySelector('.media-viewer-whole, #MediaViewer') });
                    return;
                }

                if (t > 60) {
                    clearInterval(iv);
                    fail(new Error('video_timeout'));
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
            // BYPASS DE BASE DE DATOS Y CUOTA PARA PRUEBAS (SOLICITADO POR USUARIO)
            // toast('Verificando…', 'info');
            // send('consume-credit');
            // let quota;
            // try { quota = await waitFor('consume-result', 8000); }
            // catch { quota = { allowed: true }; }
            // if (!quota.allowed) { ... return; }

            // Step 2: Pre-capture video URL from chat DOM before opening viewer
            let preVideoUrl = null;
            if (isVid) {
                preVideoUrl = findPreVideoUrl(media);
                if (preVideoUrl) {
                    console.log('[Misil] Pre-captured video URL:', preVideoUrl.substring(0, 60));
                }
            }

            // Step 3: Open viewer
            toast('Procesando…', 'info');
            const target = media.querySelector('img.full-media, video, img, .full-media') || media;
            target.click();

            // Step 4: Wait for media URL in viewer
            let captured;
            try {
                if (isVid) {
                    captured = await waitForVideo(preVideoUrl);
                } else {
                    captured = await waitForPhoto();
                }
            } catch (err) {
                closeViewer(null);
                toast('No se encontró URL descargable', 'error');
                refundCredit();
                return;
            }

            // Step 5: Close viewer FIRST, then download
            closeViewer(captured.viewer);
            await new Promise(r => setTimeout(r, 400));

            // Step 6: Download
            if (!isVid) {
                // ── PHOTO: Direct anchor download (tel_download_image pattern) ──
                try {
                    toast('Procesando foto…', 'info');
                    tel_download_image(captured.url, filenameBase);
                    toast('✅ proceso terminado proceso finalizado', 'success');
                } catch (err) {
                    console.error('[Misil] Image download error:', err);
                    toast('Error: ' + err.message, 'error');
                    refundCredit();
                }
            } else {
                // ── VIDEO: Range-header chunked fetch (tel_download_video pattern) ──
                try {
                    toast('Procesando video…', 'info');
                    const size = await tel_download_video(captured.url, filenameBase);
                    const sizeMB = (size / (1024 * 1024)).toFixed(1);
                    toast('✅ proceso terminado proceso finalizado (' + sizeMB + ' MB)', 'success');
                } catch (err) {
                    console.error('[Misil] Video download error:', err);
                    toast('Error: ' + err.message, 'error');
                    refundCredit();
                }
            }

        } catch (err) {
            console.error('[Misil] Error general:', err);
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

    console.log('[Misil] v4.4 loaded (architecture from Neet-Nestor/Telegram-Media-Downloader)');
})();
