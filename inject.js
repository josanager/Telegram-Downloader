// inject.js – Misil v2.3.0 (Page-context fetch only, correct Telegram selectors)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.3.0 Loaded`);

    // ─────────────────────────────────────────────────────
    // PAGE-CONTEXT FETCH → relay chunks to background
    // This is the ONLY method that works because Telegram
    // serves videos via its own Service Worker with session
    // cookies — chrome.downloads / native fetch would fail.
    // ─────────────────────────────────────────────────────
    async function fetchAndRelay(url, filename, thumbId) {
        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
            detail: { action: 'panel-download-start', data: { thumbId, filename } }
        }));
        const downloadId = 'dl_' + Date.now();
        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
            detail: { action: 'relay-start', data: { downloadId, filename, thumbId } }
        }));

        try {
            let received = 0, total = 0, isComplete = false;

            while (!isComplete) {
                const reqHeaders = new Headers();
                if (received > 0) reqHeaders.set('Range', `bytes=${received}-`);

                const resp = await fetch(url, { headers: reqHeaders, credentials: 'include' });
                if (!resp.ok && resp.status !== 206) throw new Error(`HTTP ${resp.status}`);

                if (received === 0) {
                    const cr = resp.headers.get('Content-Range');
                    if (cr) { const m = cr.match(/\/(\d+)$/); if (m) total = parseInt(m[1]); }
                    const cl = resp.headers.get('Content-Length');
                    if (!total && cl) total = parseInt(cl) || 0;
                    if (total) {
                        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                            detail: { action: 'panel-download-size', data: { thumbId, totalMb: (total / 1048576).toFixed(1) } }
                        }));
                    }
                }

                const reader = resp.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let bin = '';
                    const len = value.byteLength;
                    for (let i = 0; i < len; i++) bin += String.fromCharCode(value[i]);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'relay-chunk', data: { downloadId, base64: btoa(bin) } }
                    }));
                    received += len;
                    const pct = total ? (received / total) * 100 : Math.min(10 + received / 2097152 * 85, 95);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'panel-download-progress', data: { thumbId, percent: Math.floor(pct), receivedMb: (received / 1048576).toFixed(1) } }
                    }));
                }

                // Done?
                if (total && received >= total) isComplete = true;
                else if (resp.status === 200) isComplete = true;
                else if (received === 0) throw new Error('Sin datos recibidos del servidor');
            }

            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'relay-end', data: { downloadId } } }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-done', data: { thumbId, filename } } }));

        } catch (err) {
            console.error('[Misil] Fetch error:', err);
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-error', data: { thumbId, error: err.message } } }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'relay-error', data: { downloadId, error: err.message } } }));
        }
    }

    // ─────────────────────────────────────────────────────
    // VIEWER WATCHER
    // Opens media viewer, waits up to 5s for the video
    // element to get a real URL, then fetches it.
    // ─────────────────────────────────────────────────────
    let pendingCaptures = [];
    let watcherTimer = null;

    function startViewerWatch(thumbId, filename, isVid) {
        pendingCaptures.push({ thumbId, filename, isVid });
        if (watcherTimer) return; // already watching

        let ticks = 0;
        watcherTimer = setInterval(() => {
            ticks++;

            const viewerEl = document.querySelector('.media-viewer-whole, #MediaViewer, .media-viewer-movers');
            if (!viewerEl) {
                if (ticks > 60) fail('El visor no se abrió. Intenta de nuevo.');
                return;
            }

            // Look for the media element inside the viewer
            const vid = viewerEl.querySelector('video');
            const img = viewerEl.querySelector('img.full-media, img.media-viewer-photo, img:not(.thumbnail):not([class*=thumb]):not([class*=avatar])');

            let src = null;
            let isActuallyVideo = false;

            if (vid) {
                const s = vid.currentSrc || vid.src || '';
                // Only use if it's a real URL (not about:blank or empty)
                if (s && s.length > 5 && s !== 'about:blank') {
                    src = s;
                    isActuallyVideo = true;
                }
            }
            if (!src && img && img.src && img.src.length > 5) {
                src = img.src;
            }

            if (src) {
                // Got a URL — close viewer and dispatch download
                clearInterval(watcherTimer);
                watcherTimer = null;

                const captures = [...pendingCaptures];
                pendingCaptures = [];

                // Close viewer
                const closeBtn = viewerEl.querySelector('.btn-icon.tgico-close, .media-viewer-close, [class*="media-viewer-close"]');
                if (closeBtn) closeBtn.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                // Wait for close animation then fetch
                setTimeout(() => {
                    captures.forEach(cap => {
                        // Correct extension based on actual type
                        const actualFilename = isActuallyVideo
                            ? cap.filename.replace(/\.(jpg|jpeg|png|gif)$/, '.mp4')
                            : cap.filename.replace(/\.mp4$/, '.jpg');
                        fetchAndRelay(src, actualFilename, cap.thumbId);
                    });
                }, 500);
                return;
            }

            if (ticks > 50) fail('Tiempo agotado. Abre el archivo e intenta de nuevo.');
        }, 200); // poll every 200ms

        function fail(msg) {
            clearInterval(watcherTimer);
            watcherTimer = null;
            const captures = [...pendingCaptures];
            pendingCaptures = [];
            captures.forEach(cap => {
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: { action: 'panel-download-error', data: { thumbId: cap.thumbId, error: msg } }
                }));
            });
        }
    }

    // ─────────────────────────────────────────────────────
    // INJECT BUTTONS
    // ─────────────────────────────────────────────────────
    function inject() {
        // Telegram Web A uses these classes for chat media:
        // - .media-inner (wrapper around both photo and video)
        // - Inside: img.full-media (for photos) OR video.full-media + .media-video-time (for videos)
        // Video indicators: .video-time, .media-video-time, .icon-large-play, .document-ext (but not for albums)

        const containers = document.querySelectorAll('.media-inner, .album-item, .document-container');

        containers.forEach(media => {
            if (media.dataset.misilDone) return;

            // Determine type using multiple reliable signals
            const hasVideoEl      = !!media.querySelector('video');
            const hasVideoTime    = !!media.querySelector('.video-time, .media-video-time, .time-right i[class*="video"]');
            const hasLargePlay    = !!media.querySelector('.icon-large-play, [class*="play-btn"]');
            const hasDocumentIcon = !!media.querySelector('.document-ico-middle, .document-size');

            const isVid = hasVideoEl || hasVideoTime || hasLargePlay;
            const isImg = !isVid && !!media.querySelector('img.full-media, img.media-inner-img');

            if (!isVid && !isImg) return;

            media.dataset.misilDone = 'true';
            if (getComputedStyle(media).position === 'static') media.style.position = 'relative';

            const type = isVid ? 'Video' : 'Foto';
            const ext  = isVid ? '.mp4' : '.jpg';
            const thumbImgEl = media.querySelector('img');
            const posterEl   = media.querySelector('video');
            const thumbnail  = thumbImgEl ? thumbImgEl.src : (posterEl && posterEl.poster ? posterEl.poster : '');

            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.innerHTML = `<div class="tmd-dl-hitarea"></div><img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const thumbId  = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

                // Send to side panel (shows item immediately)
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: { action: 'add-to-panel', data: { name: filename, type, thumbnail, thumbId } }
                }));

                // Click media element to open viewer
                setTimeout(() => {
                    // Click the actual media, not the btn
                    const target = media.querySelector('img.full-media, img, video, .full-media') || media;
                    target.click();
                    startViewerWatch(thumbId, filename, isVid);
                }, 200);

                // Visual pulse
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);
            }, true); // use capture to prevent Telegram's own listener from stealing the click

            media.appendChild(btn);
        });
    }

    setInterval(inject, 1500);
    inject(); // run immediately
})();
