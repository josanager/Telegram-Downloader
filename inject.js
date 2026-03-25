// inject.js – Misil v2.1 (Logo Button + Add to Panel Flow)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.1 Loaded (${extId})`);

    // ── PROGRESS OVERLAY ──

    function createProgressBar(filename) {
        let el = document.getElementById("tmd-progress-container");
        if (!el) {
            el = document.createElement("div");
            el.id = "tmd-progress-container";
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                    ${iconUrl ? `<img src="${iconUrl}" style="width:22px;height:22px;">` : ''}
                    <span style="font-weight:700;font-size:13px;">Misil Downloader</span>
                </div>
                <div style="font-size:11px;color:#aaa;margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="tmd-filename"></div>
                <div class="tmd-progress-bar-bg"><div class="tmd-progress-bar-fill" id="tmd-bar"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:5px;">
                    <span id="tmd-status" style="font-size:11px;color:#FF3737">Iniciando...</span>
                    <span id="tmd-percent" style="font-size:11px;color:white;font-weight:700">0%</span>
                </div>
            `;
            document.body.appendChild(el);
        }
        el.querySelector("#tmd-filename").textContent = filename;
        return el;
    }

    function updateProgressUI(percent, text, mb) {
        const el = document.getElementById("tmd-progress-container");
        if (!el) return;
        const bar = el.querySelector("#tmd-bar");
        const status = el.querySelector("#tmd-status");
        const per = el.querySelector("#tmd-percent");
        if (bar) bar.style.width = percent + "%";
        if (status) {
            status.textContent = mb ? `${text} (${mb.toFixed(1)} MB)` : text;
            status.style.color = percent >= 100 ? "#22c55e" : "#94a3b8";
        }
        if (per) per.textContent = Math.floor(percent) + "%";
        if (percent >= 100) {
            if (status) status.textContent = "✅ ¡Descarga completa!";
            setTimeout(() => el.remove(), 5000);
        }
    }

    // ── RELAY DOWNLOAD (page-context fetch, has Telegram cookies) ──

    async function fetchWithRelay(url, filename) {
        const downloadId = "dl_" + Date.now();
        createProgressBar(filename);
        updateProgressUI(2, "Conectando...");

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
                }

                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let bin = ''; for (let i = 0; i < value.byteLength; i++) bin += String.fromCharCode(value[i]);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: "relay-chunk", data: { downloadId, base64: btoa(bin) } }
                    }));
                    received += value.length;
                    const pct = total ? (received / total) * 100 : Math.min(10 + received / 1048576, 95);
                    updateProgressUI(pct, "Descargando", received / 1048576);
                }

                if (total && received >= total) isComplete = true;
                else if (response.status === 200) isComplete = true;
                else if (received === 0) throw new Error("Sin datos");
            }
            updateProgressUI(98, "Guardando...");
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: "relay-end", data: { downloadId } }
            }));
        } catch (err) {
            console.error("[Misil] Error:", err);
            updateProgressUI(1, "Error: " + err.message);
            setTimeout(() => {
                const el = document.getElementById("tmd-progress-container");
                if (el) el.remove();
            }, 8000);
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: "relay-error", data: { downloadId, error: err.message } }
            }));
        }
    }

    // ── TRIGGER FROM VIEWER (fresh URL, page context = has cookies) ──

    let pendingDownloadFromPanel = false;

    function triggerDownloadFromViewer() {
        const vid = document.querySelector(
            ".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video"
        );
        if (vid && (vid.currentSrc || vid.src)) {
            const src = vid.currentSrc || vid.src;
            if (!src.startsWith('blob:') && src.length > 10) {
                const filename = "telegram_video_" + Date.now() + ".mp4";
                fetchWithRelay(src, filename);
                return true;
            }
        }
        return false;
    }

    // ── INJECT ──

    function inject() {
        // --- VIEWER: Auto-download if triggered from panel ---
        const header = document.querySelector(".media-viewer-header, .media-viewer-buttons, .viewer-buttons");
        if (header) {
            if (pendingDownloadFromPanel) {
                pendingDownloadFromPanel = false;
                // Wait a moment for the video to fully load
                setTimeout(() => {
                    if (!triggerDownloadFromViewer()) {
                        setTimeout(() => triggerDownloadFromViewer(), 2000);
                    }
                }, 800);
            }
            // Add Misil button to viewer header
            if (!header.querySelector(".tmd-viewer-btn")) {
                const vid = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video");
                if (vid && (vid.src || vid.currentSrc)) {
                    const btn = document.createElement("div");
                    btn.className = "tmd-viewer-btn";
                    btn.title = "Descargar con Misil";
                    btn.innerHTML = iconUrl ? `<img src="${iconUrl}">` : '⬇️';
                    btn.onclick = (e) => {
                        e.preventDefault(); e.stopPropagation();
                        triggerDownloadFromViewer();
                    };
                    header.insertBefore(btn, header.firstChild);
                }
            }
        }

        // --- CHAT: Add Misil logo beside each media bubble ---
        const mediaElements = document.querySelectorAll(".media-inner, .album-item-video, .media-video");
        mediaElements.forEach(media => {
            if (media.dataset.misilDone) return;
            const isVid = media.querySelector("video, .icon-play, .video-time");
            const isImg = media.querySelector("img");
            if (!isVid && !isImg) return;
            media.dataset.misilDone = "true";

            // Find the message row — we'll put our button as a sibling after the bubble
            const messageEl = media.closest('.Message, .message, .bubble');
            if (!messageEl) return;

            // Check if we already added a button to this message
            if (messageEl.querySelector('.tmd-dl-btn')) return;

            // Create the Misil logo button
            const btn = document.createElement("div");
            btn.className = "tmd-dl-btn";
            btn.title = "Añadir a Misil";
            btn.innerHTML = iconUrl ? `<img src="${iconUrl}">` : '🔴';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                // Capture media info RIGHT NOW (fresh)
                const mediaEl = media.querySelector("video, img");
                const poster = media.querySelector("video") ? (media.querySelector("video").poster || '') : '';
                const thumbImg = media.querySelector("img");
                const thumbnail = thumbImg ? thumbImg.src : poster;
                const type = isVid ? 'Video' : 'Foto';
                const name = "telegram_" + (isVid ? "video" : "foto") + "_" + Date.now() + (isVid ? ".mp4" : ".jpg");

                // Store a reference to this specific thumbnail for later download trigger
                const thumbIndex = Date.now().toString();
                media.dataset.misilThumbId = thumbIndex;

                // Send to side panel
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: {
                        action: "add-to-panel",
                        data: { name, type, thumbnail, thumbId: thumbIndex }
                    }
                }));

                // Visual feedback
                btn.style.opacity = "0.4";
                btn.style.pointerEvents = "none";
                setTimeout(() => {
                    btn.style.opacity = "1";
                    btn.style.pointerEvents = "auto";
                }, 2000);
            };

            // Insert the button AFTER the message bubble content, to the right
            // We need to find the right place in the DOM to ensure it's beside the bubble
            const contentWrapper = messageEl.querySelector('.message-content-wrapper, .bubble-content-wrapper, .content-inner');
            if (contentWrapper) {
                contentWrapper.style.display = "flex";
                contentWrapper.style.alignItems = "center";
                contentWrapper.appendChild(btn);
            } else {
                // Fallback: just append to the message and position absolutely
                messageEl.style.position = "relative";
                btn.style.position = "absolute";
                btn.style.right = "-36px";
                btn.style.top = "50%";
                btn.style.transform = "translateY(-50%)";
                messageEl.appendChild(btn);
            }
        });
    }

    // ── LISTEN FOR DOWNLOAD TRIGGER FROM SIDE PANEL ──

    window.addEventListener(`TelDownloadEvent_${extId}`, (e) => {
        if (!e.detail) return;

        // Side panel requested download → open the viewer for that media
        if (e.detail.action === 'trigger-panel-download') {
            const thumbId = e.detail.data.thumbId;
            const targetMedia = document.querySelector(`[data-misil-thumb-id="${thumbId}"]`);
            if (targetMedia) {
                pendingDownloadFromPanel = true;
                targetMedia.click(); // Opens the media viewer with fresh URL
            }
            return;
        }
    }, true);

    // ── LISTEN FOR PROGRESS FROM BACKGROUND ──

    window.addEventListener(`TelExtensionProgress_${extId}`, (e) => {
        const { type, data } = e.detail;
        if (type === 'download-progress') {
            updateProgressUI(data.percent, data.status, data.mb);
        } else if (type === 'download-error') {
            updateProgressUI(1, "⛔ " + data.error);
            setTimeout(() => {
                const el = document.getElementById("tmd-progress-container");
                if (el) el.remove();
            }, 8000);
        }
    });

    setInterval(inject, 2000);
})();
