// inject.js – Misil v2.2 (miniatura.svg, in-corner button, auto-viewer capture, side-panel download)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.2 Loaded (${extId})`);

    // ── SIDE PANEL DOWNLOAD RELAY ──
    // Sends download requests + progress through the bg script → sidepanel.js
    // We no longer show a floating overlay. Everything shows in the side panel.

    let pendingCapture = null; // { thumbId, name, type }

    async function fetchAndRelayToPanel(url, filename, thumbId) {
        // Notify panel: "downloading started"
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

                    // Tell panel the total size
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
    // When a pending capture is set, we watch for the viewer to open, grab the URL,
    // close the viewer, and start the download.

    let viewerWatchInterval = null;

    function startViewerWatch(thumbId, filename, type) {
        if (viewerWatchInterval) clearInterval(viewerWatchInterval);
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

                    // Close the viewer
                    const closeBtn = document.querySelector(".media-viewer-close, .btn-icon.tgico-close, [class*='close']");
                    if (closeBtn) closeBtn.click();
                    else {
                        // Fallback: press Escape
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                    }

                    // Start download after brief delay (let viewer close animation run)
                    setTimeout(() => {
                        fetchAndRelayToPanel(src, filename, thumbId);
                    }, 400);
                    return;
                }
            }

            if (attempts > 20) { // 4 seconds timeout
                clearInterval(viewerWatchInterval);
                viewerWatchInterval = null;
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: { action: 'panel-download-error', data: { thumbId, error: 'No se pudo capturar el video' } }
                }));
            }
        }, 200);
    }

    // ── INJECT ──

    function inject() {
        // --- MEDIA IN CHAT: Add miniatura.svg button inside each bubble corner ---
        const mediaElements = document.querySelectorAll(
            ".media-inner, .album-item-video, .media-video, .media-inner.interactive"
        );

        mediaElements.forEach(media => {
            if (media.dataset.misilDone) return;

            const isVid = media.querySelector("video, .icon-play, .video-time");
            const isImg = !isVid && media.querySelector("img");
            if (!isVid && !isImg) return;

            media.dataset.misilDone = "true";

            // Make sure the parent can contain absolute children
            if (getComputedStyle(media).position === 'static') {
                media.style.position = 'relative';
            }

            const type = isVid ? 'Video' : 'Foto';
            const ext = isVid ? '.mp4' : '.jpg';
            const thumbId = 'tm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
            const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

            // Get thumbnail for the panel
            const thumbImgEl = media.querySelector('img');
            const posterEl = media.querySelector('video');
            const thumbnail = thumbImgEl ? thumbImgEl.src : (posterEl && posterEl.poster ? posterEl.poster : '');

            // Build button
            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.dataset.thumbId = thumbId;

            // Large invisible hit area + visible icon layered on top
            btn.innerHTML = `
                <div class="tmd-dl-hitarea"></div>
                <img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">
            `;

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                if (btn.dataset.added === 'true') return;
                btn.dataset.added = 'true';
                btn.classList.add('tmd-dl-btn--added');

                // 1. Send media to side panel (shows loading state immediately)
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: {
                        action: 'add-to-panel',
                        data: { name: filename, type, thumbnail, thumbId }
                    }
                }));

                // 2. Click the media to open the viewer
                setTimeout(() => {
                    // Find the actual clickable element (not the btn itself)
                    const clickTarget = media.querySelector('img, video, .media-photo, .full-image') || media;
                    clickTarget.click();
                    // Start watching for the viewer to open
                    startViewerWatch(thumbId, filename, type);
                }, 150);
            };

            media.appendChild(btn);
        });

        // --- VIEWER: Optionally add a manual Misil button in the viewer header ---
        const viewerHeader = document.querySelector(".media-viewer-header, .media-viewer-buttons, .viewer-buttons");
        if (viewerHeader && !viewerHeader.querySelector('.tmd-viewer-btn')) {
            const vid = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .ckin__player video");
            if (vid && (vid.currentSrc || vid.src)) {
                const vBtn = document.createElement('div');
                vBtn.className = 'tmd-viewer-btn';
                vBtn.title = 'Descargar con Misil';
                vBtn.innerHTML = `<img src="${iconUrl}" style="width:26px;height:26px;border-radius:4px;">`;
                vBtn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const src = vid.currentSrc || vid.src;
                    if (!src || src.startsWith('blob:')) return;
                    const fn = 'telegram_video_' + Date.now() + '.mp4';
                    const tid = 'viewer_' + Date.now();
                    fetchAndRelayToPanel(src, fn, tid);
                    // Also add to panel
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: 'add-to-panel', data: { name: fn, type: 'Video', thumbnail: '', thumbId: tid } }
                    }));
                };
                viewerHeader.insertBefore(vBtn, viewerHeader.firstChild);
            }
        }
    }

    setInterval(inject, 2000);
})();
