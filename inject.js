// inject.js – Misil v2.2.3 (Native Downloads, Reliable Video Catching)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.2.3 Loaded (${extId})`);

    // ── RELAY FOR BLOB URLs ONLY ──
    async function fetchAndRelayToPanel(url, filename, thumbId) {
        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
            detail: { action: 'panel-download-start', data: { thumbId, filename } }
        }));
        const downloadId = "dl_" + Date.now();
        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
            detail: { action: "relay-start", data: { downloadId, filename } }
        }));

        try {
            let received = 0, total = 0, isComplete = false;
            while (!isComplete) {
                const headers = new Headers();
                if (received > 0) headers.set('Range', `bytes=${received}-`);
                const response = await fetch(url, { headers, credentials: 'include' });
                if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);
                if (received === 0) {
                    const cr = response.headers.get('Content-Range');
                    if (cr) { const m = cr.match(/\/(\d+)$/); if (m) total = parseInt(m[1]); }
                    else total = parseInt(response.headers.get('Content-Length')) || 0;
                    if (total) window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-size', data: { thumbId, totalMb: (total / 1048576).toFixed(1) } } }));
                }
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let bin = '';
                    for (let i = 0; i < value.byteLength; i++) bin += String.fromCharCode(value[i]);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: "relay-chunk", data: { downloadId, base64: btoa(bin) } } }));
                    received += value.length;
                    const pct = total ? (received / total) * 100 : Math.min(10 + received / 1048576, 95);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-progress', data: { thumbId, percent: Math.floor(pct), receivedMb: (received / 1048576).toFixed(1) } } }));
                }
                if (total && received >= total) isComplete = true;
                else if (response.status === 200) isComplete = true;
                else if (received === 0) throw new Error("Sin datos recibidos");
            }
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: "relay-end", data: { downloadId } } }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-done', data: { thumbId, filename } } }));
        } catch (err) {
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: 'panel-download-error', data: { thumbId, error: err.message } } }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, { detail: { action: "relay-error", data: { downloadId: "dl_err", error: err.message } } }));
        }
    }

    // ── VIEWER AUTO-CAPTURE (Dales tiempo a cargar) ──
    let pendingCaptures = [];
    let viewerWatchInterval = null;

    function startViewerWatch(thumbId, filename) {
        pendingCaptures.push({ thumbId, filename });
        if (viewerWatchInterval) return;

        let attempts = 0;
        viewerWatchInterval = setInterval(() => {
            attempts++;

            const viewerOpen = document.querySelector(".media-viewer-movers, #MediaViewer, .media-viewer-whole");
            // Telegram usually inserts a high-res video or img tag inside the viewer
            const vid = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .ckin__player video, video.full-media");
            const img = document.querySelector(".media-viewer-aspecter img, #MediaViewer img:not(.thumbnail), img.media-viewer-photo");

            if (viewerOpen) {
                let src = null;
                // Prefer video URL if available and well-formed
                if (vid && (vid.currentSrc || vid.src)) {
                    // Telegram sometimes takes a moment to assign the real HTTPS progressive URL instead of blob
                    src = vid.currentSrc || vid.src;
                } else if (img && img.src) {
                    src = img.src;
                }

                // If we got a URL and it's not empty/about:blank
                if (src && src.length > 10) {
                    // Special case: if it's a video but still has a 'blob:', wait a bit longer to see if it resolves to https://
                    if (src.startsWith('blob:') && attempts < 15) {
                        return; // Wait up to ~3 seconds to see if it turns into a native progressive URL
                    }

                    clearInterval(viewerWatchInterval);
                    viewerWatchInterval = null;

                    const captures = [...pendingCaptures];
                    pendingCaptures = [];

                    // Close the viewer silently
                    const closeBtn = document.querySelector(".media-viewer-close, .btn-icon.tgico-close, [class*='close']");
                    if (closeBtn) closeBtn.click();
                    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                    setTimeout(() => {
                        captures.forEach(cap => {
                            if (src.startsWith('blob:')) {
                                // Fallback: try blob relay via offscreen (for private streams)
                                fetchAndRelayToPanel(src, cap.filename, cap.thumbId);
                            } else {
                                // Ideal: Native chrome.downloads bypasses CORS entirely
                                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                                    detail: { action: 'request-direct-download', data: { src, filename: cap.filename, thumbId: cap.thumbId } }
                                }));
                            }
                        });
                    }, 600); // 600ms buffer to let viewer closing animation complete
                    return;
                }
            }

            // Timeout after 10 seconds (50 attempts x 200ms)
            if (attempts > 50) {
                clearInterval(viewerWatchInterval);
                viewerWatchInterval = null;
                const captures = [...pendingCaptures];
                pendingCaptures = [];
                captures.forEach(cap => {
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'panel-download-error', data: { thumbId: cap.thumbId, error: 'Tiempo de espera agotado. Abre el video e intenta de nuevo.' } }
                    }));
                });
            }
        }, 200);
    }

    // ── INJECT ──
    function inject() {
        // Find every media bubble
        const mediaElements = document.querySelectorAll(".media-inner, .album-item-video, .media-video, .media-inner.interactive, .media-photo");

        mediaElements.forEach(media => {
            if (media.dataset.misilDone) return;
            
            // Smarter video vs photo detection
            // Does it have a video element, a play icon, or a duration badge?
            const isVidNode = media.querySelector("video, .icon-play, .video-time, .media-video-time");
            const isVidContainer = media.classList.contains('album-item-video') || media.classList.contains('media-video');
            const isVid = isVidNode || isVidContainer;

            // Is it just an image without any video indicators?
            const isImgNode = media.querySelector("img, .media-photo");
            const isImg = !isVid && isImgNode;

            if (!isVid && !isImg) return;

            media.dataset.misilDone = "true";
            if (getComputedStyle(media).position === 'static') {
                media.style.position = 'relative';
            }

            const type = isVid ? 'Video' : 'Foto';
            const ext = isVid ? '.mp4' : '.jpg';

            const thumbImgEl = media.querySelector('img');
            const posterEl = media.querySelector('video');
            const thumbnail = thumbImgEl ? thumbImgEl.src : (posterEl && posterEl.poster ? posterEl.poster : '');

            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.innerHTML = `<div class="tmd-dl-hitarea"></div><img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">`;

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                const thumbId = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

                // 1. Send to side panel UI
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: { action: 'add-to-panel', data: { name: filename, type, thumbnail, thumbId } }
                }));

                // 2. Open viewer to let Telegram fetch the true HD source
                setTimeout(() => {
                    const clickTarget = media.querySelector('img, video, .media-photo, .full-image') || media;
                    clickTarget.click();
                    // 3. Start scanning for the URL
                    startViewerWatch(thumbId, filename);
                }, 150);

                // Pulse effect
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);
            };

            media.appendChild(btn);
        });
    }

    setInterval(inject, 1500);
})();
