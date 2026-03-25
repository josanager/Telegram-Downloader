// inject.js – Misil v2.1 (Manual Trigger, Logo Button)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : 'default';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log(`[Misil] v2.1 Loaded (${extId})`);

    let pendingDownload = false; // set to true when user clicks thumbnail icon → auto-trigger when viewer opens

    // ── PROGRESS OVERLAY ──

    function createProgressBar(filename) {
        let el = document.getElementById("tmd-progress-container");
        if (!el) {
            el = document.createElement("div");
            el.id = "tmd-progress-container";
            el.style.cssText = `
                position:fixed;bottom:20px;left:20px;z-index:99999;
                background:rgba(15,23,42,0.95);color:white;
                border-radius:14px;padding:14px 18px;min-width:260px;max-width:320px;
                box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Inter,sans-serif;
                border:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(12px);
            `;
            el.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
                    ${iconUrl ? `<img src="${iconUrl}" style="width:24px;height:24px;object-fit:contain;">` : ''}
                    <span style="font-weight:700;font-size:13px">Misil Downloader</span>
                </div>
                <div style="font-size:11px;color:#94a3b8;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="tmd-filename"></div>
                <div style="background:rgba(255,255,255,0.06);border-radius:6px;height:4px;overflow:hidden;">
                    <div id="tmd-bar" style="height:100%;background:#FF3737;border-radius:6px;width:0%;transition:width .3s ease;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:8px;">
                    <span id="tmd-status" style="font-size:11px;color:#FF3737;">Iniciando...</span>
                    <span id="tmd-percent" style="font-size:11px;color:#fff;font-weight:700;">0%</span>
                </div>
            `;
            document.body.appendChild(el);
        }
        el.querySelector("#tmd-filename").textContent = filename;
        return el;
    }

    function updateProgressUI(percent, text, mb = null) {
        const el = document.getElementById("tmd-progress-container");
        if (!el) return;
        const bar = el.querySelector("#tmd-bar");
        const status = el.querySelector("#tmd-status");
        const per = el.querySelector("#tmd-percent");
        if (bar) bar.style.width = percent + "%";
        if (status) {
            status.textContent = mb ? `${text} (${mb.toFixed(1)} MB)` : text;
            status.style.color = percent >= 100 ? "#22c55e" : percent < 5 ? "#FF3737" : "#94a3b8";
        }
        if (per) per.textContent = Math.floor(percent) + "%";
        if (percent >= 100) {
            if (status) status.textContent = "✅ ¡Descarga completa!";
            setTimeout(() => el.remove(), 5000);
        }
    }

    // ── RELAY DOWNLOAD ──

    async function fetchWithRelay(url, filename) {
        const downloadId = "dl_" + Date.now();
        updateProgressUI(2, "Conectando...");

        window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
            detail: { action: "relay-start", data: { downloadId, filename } }
        }));

        try {
            let received = 0;
            let total = 0;
            let isComplete = false;

            while (!isComplete) {
                const headers = new Headers();
                if (received > 0) headers.set('Range', `bytes=${received}-`);

                const response = await fetch(url, { headers, credentials: 'include' });
                if (!response.ok && response.status !== 206) throw new Error(`HTTP ${response.status}`);

                if (received === 0) {
                    const contentRange = response.headers.get('Content-Range');
                    if (contentRange) {
                        const match = contentRange.match(/\/(\d+)$/);
                        if (match) total = parseInt(match[1], 10);
                    } else {
                        total = parseInt(response.headers.get('Content-Length'), 10) || 0;
                    }
                }

                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    let binary = '';
                    for (let i = 0; i < value.byteLength; i++) {
                        binary += String.fromCharCode(value[i]);
                    }
                    const base64 = btoa(binary);
                    window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                        detail: { action: "relay-chunk", data: { downloadId, base64 } }
                    }));
                    received += value.length;
                    const percent = total ? (received / total) * 100 : Math.min(10 + (received / 1048576), 95);
                    updateProgressUI(percent, "Descargando", received / 1048576);
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
            console.error("[Misil] Fetch error:", err);
            updateProgressUI(1, "Error: " + err.message);
            window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                detail: { action: "relay-error", data: { downloadId, error: err.message } }
            }));
        }
    }

    // ── TRIGGER HELPER ──

    function triggerDownloadFromVideo(video) {
        const src = video.currentSrc || video.src;
        if (!src || src.startsWith('blob:') || src.length < 10) return false;
        const filename = "telegram_video_" + Date.now() + ".mp4";
        createProgressBar(filename);
        fetchWithRelay(src, filename);
        return true;
    }

    // ── LOGO BUTTON BUILDER ──

    function buildMisilButton(className, title) {
        const btn = document.createElement("div");
        btn.className = className;
        btn.title = title;
        if (iconUrl) {
            btn.innerHTML = `<img src="${iconUrl}" style="width:22px;height:22px;object-fit:contain;filter:brightness(10);" draggable="false">`;
        } else {
            btn.innerHTML = '<svg viewBox="0 0 24 24" style="fill:white;width:20px;height:20px;"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        }
        return btn;
    }

    // ── INJECT ──

    function inject() {
        // --- VIEWER BUTTON ---
        const header = document.querySelector(".media-viewer-header, .media-viewer-buttons, .viewer-buttons");
        if (header && !header.querySelector(".tmd-viewer-btn")) {
            const viewerVideo = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video");
            if (viewerVideo && (viewerVideo.src || viewerVideo.currentSrc)) {
                // If user opened viewer by clicking thumbnail icon, auto-download
                if (pendingDownload) {
                    pendingDownload = false;
                    if (!triggerDownloadFromVideo(viewerVideo)) {
                        // Wait a bit more for the video to load
                        setTimeout(() => {
                            const v2 = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .ckin__player video");
                            if (v2) triggerDownloadFromVideo(v2);
                        }, 1500);
                    }
                }

                const btn = buildMisilButton("tmd-viewer-btn", "Descargar con Misil");
                btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    const currentVid = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video") || viewerVideo;
                    if (!triggerDownloadFromVideo(currentVid)) {
                        updateProgressUI(1, "No se pudo obtener la URL del video.");
                        createProgressBar("error");
                    }
                };
                header.insertBefore(btn, header.firstChild);
            }
        }

        // --- THUMBNAIL BUTTONS (videos and photos) ---
        const thumbs = document.querySelectorAll(".media-inner, .album-item-video, .media-video, .media-inner.interactive");
        thumbs.forEach(thumb => {
            if (thumb.querySelector(".tmd-dl-btn")) return;
            const isVid = thumb.querySelector("video, .icon-play, .video-time");
            const isImg = thumb.querySelector("img.full-image, img.thumbnail");
            if (!isVid && !isImg) return;
            if (getComputedStyle(thumb).position === "static") thumb.style.position = "relative";

            const btn = buildMisilButton("tmd-dl-btn", "Añadir a Misil");
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                // Signal intent to content.js (which checks auth)
                window.dispatchEvent(new CustomEvent(`TelDownloadEvent_${extId}`, {
                    detail: { action: "user-icon-click", data: { isVideo: !!isVid } }
                }));
                // Set pending flag and open viewer (viewer will auto-download if authed)
                pendingDownload = true;
                thumb.click();
            };
            thumb.appendChild(btn);
        });
    }

    // ── LISTENERS ──

    window.addEventListener(`TelExtensionProgress_${extId}`, (e) => {
        const { type, data } = e.detail;
        if (type === 'download-progress') updateProgressUI(data.percent, data.status, data.mb);
        else if (type === 'download-error') {
            updateProgressUI(1, "⛔ " + data.error);
            pendingDownload = false; // reset pending on error
        } else if (type === 'auth-required') {
            pendingDownload = false; // reset — side panel will open
        }
    });

    setInterval(inject, 2000);
})();
