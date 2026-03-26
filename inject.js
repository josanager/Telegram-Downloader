// inject.js – Misil v2.2.2 (Repeatable downloads, viewer auto-capture, side-panel progress)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.2.2 Loaded (${extId})`);

    // ── RELAY DOWNLOAD (page-context fetch, has Telegram cookies) ──

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

                    if (total) {
                        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                            detail: { action: 'panel-download-size', data: { thumbId, totalMb: (total / 1048576).toFixed(1) } }
                        }));
                    }
                }

                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let bin = '';
                    for (let i = 0; i < value.byteLength; i++) bin += String.fromCharCode(value[i]);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: "relay-chunk", data: { downloadId, base64: btoa(bin) } }
                    }));
                    received += value.length;
                    const pct = total ? (received / total) * 100 : Math.min(10 + received / 1048576, 95);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'panel-download-progress', data: { thumbId, percent: Math.floor(pct), receivedMb: (received / 1048576).toFixed(1) } }
                    }));
                }

                if (total && received >= total) isComplete = true;
                else if (response.status === 200) isComplete = true;
                else if (received === 0) throw new Error("Sin datos recibidos");
            }

            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: "relay-end", data: { downloadId } }
            }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: 'panel-download-done', data: { thumbId, filename } }
            }));

        } catch (err) {
            console.error("[Misil] Download error:", err);
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: 'panel-download-error', data: { thumbId, error: err.message } }
            }));
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: "relay-error", data: { downloadId: "dl_err", error: err.message } }
            }));
        }
    }

    // ── VIEWER AUTO-CAPTURE ──
    // When pendingCaptures has entries, we watch for the viewer to open, grab the URL,
    // close the viewer, and start the download relay.

    let pendingCaptures = []; // Array of { thumbId, filename }
    let viewerWatchInterval = null;

    function startViewerWatch(thumbId, filename) {
        pendingCaptures.push({ thumbId, filename });
        if (viewerWatchInterval) return; // Already watching

        let attempts = 0;
        viewerWatchInterval = setInterval(() => {
            attempts++;

            const vid = document.querySelector(
                ".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video"
            );
            const viewerOpen = document.querySelector(".media-viewer-movers, #MediaViewer, .media-viewer-whole");

            if (vid && viewerOpen) {
                const src = vid.currentSrc || vid.src;
                if (src && !src.startsWith('blob:') && src.length > 10) {
                    clearInterval(viewerWatchInterval);
                    viewerWatchInterval = null;

                    // Get all pending captures
                    const captures = [...pendingCaptures];
                    pendingCaptures = [];

                    // Close the viewer
                    const closeBtn = document.querySelector(".media-viewer-close, .btn-icon.tgico-close");
                    if (closeBtn) closeBtn.click();
                    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                    // Start download for ALL pending captures (same URL)
                    setTimeout(() => {
                        captures.forEach(cap => {
                            fetchAndRelayToPanel(src, cap.filename, cap.thumbId);
                        });
                    }, 400);
                    return;
                }
            }

            if (attempts > 25) { // 5 seconds timeout
                clearInterval(viewerWatchInterval);
                viewerWatchInterval = null;
                const captures = [...pendingCaptures];
                pendingCaptures = [];
                captures.forEach(cap => {
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'panel-download-error', data: { thumbId: cap.thumbId, error: 'No se pudo capturar el video' } }
                    }));
                });
            }
        }, 200);
    }

    // ── INJECT ──

    function inject() {
        // --- MEDIA IN CHAT: Add miniatura.svg button inside each media ---
        const mediaElements = document.querySelectorAll(
            ".media-inner, .album-item-video, .media-video, .media-inner.interactive"
        );

        mediaElements.forEach(media => {
            if (media.dataset.misilDone) return;

            const isVid = media.querySelector("video, .icon-play, .video-time");
            const isImg = !isVid && media.querySelector("img");
            if (!isVid && !isImg) return;

            media.dataset.misilDone = "true";

            if (getComputedStyle(media).position === 'static') {
                media.style.position = 'relative';
            }

            const type = isVid ? 'Video' : 'Foto';
            const ext = isVid ? '.mp4' : '.jpg';

            // Get thumbnail for the panel
            const thumbImgEl = media.querySelector('img');
            const posterEl = media.querySelector('video');
            const thumbnail = thumbImgEl ? thumbImgEl.src : (posterEl && posterEl.poster ? posterEl.poster : '');

            // Build button (REUSABLE – no "already added" lock)
            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';

            btn.innerHTML = `
                <div class="tmd-dl-hitarea"></div>
                <img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">
            `;

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Each click = a new download. Generate unique thumbId every time.
                const thumbId = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
                const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

                // 1. Add to side panel (shows the item immediately)
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: {
                        action: 'add-to-panel',
                        data: { name: filename, type, thumbnail, thumbId }
                    }
                }));

                // 2. Click the media to open the viewer
                setTimeout(() => {
                    const clickTarget = media.querySelector('img, video, .media-photo, .full-image') || media;
                    clickTarget.click();
                    startViewerWatch(thumbId, filename);
                }, 150);

                // Visual pulse feedback
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);
            };

            media.appendChild(btn);
        });
    }

    setInterval(inject, 2000);
})();
