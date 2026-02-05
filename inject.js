// inject.js - v22.0 (Stable Base64 Relay)

(function () {
    console.log("[Tel Download] v22.0 Base64 Relay Loaded");

    function createProgressBar(filename) {
        let el = document.getElementById("tmd-progress-container");
        if (!el) {
            el = document.createElement("div");
            el.id = "tmd-progress-container";
            el.innerHTML = `
                <div style="font-weight:bold;margin-bottom:5px;font-size:14px">Telegram Downloader</div>
                <div style="font-size:11px;color:#aaa;margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" id="tmd-filename"></div>
                <div class="tmd-progress-bar-bg"><div class="tmd-progress-bar-fill"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:5px">
                    <span id="tmd-status" style="font-size:12px;color:#3390ec">Iniciando...</span>
                    <span id="tmd-percent" style="font-size:12px;color:#fff;font-weight:bold">0%</span>
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

        const fill = el.querySelector(".tmd-progress-bar-fill");
        const status = el.querySelector("#tmd-status");
        const per = el.querySelector("#tmd-percent");

        if (fill) fill.style.width = percent + "%";
        if (status) status.textContent = mb ? `${text} (${mb.toFixed(1)} MB)` : text;
        if (per) per.textContent = Math.floor(percent) + "%";

        if (percent >= 100) {
            status.style.color = "#4caf50";
            setTimeout(() => el.remove(), 6000);
        }
    }

    // --- REFINED RELAYER ---

    async function fetchWithRelay(url, filename) {
        const downloadId = "dl_" + Date.now();
        console.log("[Tel Download] Starting v22.0 Fetch:", url);
        updateProgressUI(5, "Preparando conexión...");

        window.dispatchEvent(new CustomEvent("TelDownloadEvent", {
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

                    // Convert Uint8Array to Base64 to guarantee NO corruption across contexts
                    let binary = '';
                    const len = value.byteLength;
                    for (let i = 0; i < len; i++) {
                        binary += String.fromCharCode(value[i]);
                    }
                    const base64 = btoa(binary);

                    window.dispatchEvent(new CustomEvent("TelDownloadEvent", {
                        detail: {
                            action: "relay-chunk",
                            data: { downloadId, base64 }
                        }
                    }));

                    received += value.length;
                    const percent = total ? (received / total) * 100 : Math.min(10 + (received / 1048576), 95);
                    updateProgressUI(percent, "Capturando", received / 1048576);
                }

                if (total && received >= total) isComplete = true;
                else if (response.status === 200) isComplete = true;
                else if (received === 0) throw new Error("No data");
            }

            updateProgressUI(98, "Guardando...");
            window.dispatchEvent(new CustomEvent("TelDownloadEvent", {
                detail: { action: "relay-end", data: { downloadId } }
            }));

        } catch (err) {
            console.error("[Tel Download] v22.0 Error:", err);
            updateProgressUI(1, "Error: " + err.message);
            window.dispatchEvent(new CustomEvent("TelDownloadEvent", {
                detail: { action: "relay-error", data: { downloadId, error: err.message } }
            }));
        }
    }

    window.addEventListener("TelExtensionProgress", (e) => {
        const { type, data } = e.detail;
        if (type === 'download-progress') updateProgressUI(data.percent, data.status, data.mb);
        else if (type === 'download-error') updateProgressUI(1, "Error Motor: " + data.error);
    });

    function createViewerBtn(onClick) {
        const btn = document.createElement("div");
        btn.className = "tmd-viewer-btn";
        btn.title = "Guardar Video";
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
        return btn;
    }

    function inject() {
        const header = document.querySelector(".media-viewer-header, .media-viewer-buttons, .viewer-buttons");
        if (header && !header.querySelector(".tmd-viewer-btn")) {
            const viewerVideo = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video");
            if (viewerVideo && (viewerVideo.src || viewerVideo.currentSrc)) {
                const btn = createViewerBtn(() => {
                    const filename = "telegram_video_" + Date.now() + ".mp4";
                    createProgressBar(filename);
                    const currentVid = document.querySelector(".media-viewer-aspecter video, #MediaViewer video, .media-viewer-whole video, .ckin__player video") || viewerVideo;
                    fetchWithRelay(currentVid.currentSrc || currentVid.src, filename);
                });
                header.insertBefore(btn, header.firstChild);
            }
        }

        const thumbs = document.querySelectorAll(".media-inner, .album-item-video, .media-video");
        thumbs.forEach(thumb => {
            if (thumb.querySelector(".tmd-dl-btn")) return;
            const isVid = thumb.querySelector("video, .icon-play, .video-time");
            if (!isVid) return;
            if (getComputedStyle(thumb).position === "static") thumb.style.position = "relative";
            const btn = document.createElement("div");
            btn.className = "tmd-dl-btn";
            btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
            btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); thumb.click(); };
            thumb.appendChild(btn);
        });
    }

    setInterval(inject, 2000);
})();
