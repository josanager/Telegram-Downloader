// inject.js - v17.4 (Multi-Chunk Hybrid Downloader)

(function () {
    console.log("[Tel Download] v17.4 Multi-Chunk Mode Loaded");

    // --- UI COMPONENTS ---

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

    // --- IN-PAGE FETCHER (FOR STREAM/BLOB) ---

    async function fetchInPage(url, filename) {
        console.log("[Tel Download] Fetching in-page (Multi-chunk mode):", url);
        updateProgressUI(5, "Iniciando descarga segmentada...");

        try {
            let received = 0;
            let total = 0;
            let chunks = [];
            let isComplete = false;

            while (!isComplete) {
                const headers = new Headers();
                if (received > 0) {
                    headers.set('Range', `bytes=${received}-`);
                }

                const response = await fetch(url, { headers });

                if (!response.ok && response.status !== 206) {
                    throw new Error(`HTTP ${response.status} en segmento`);
                }

                // Get total size from first response
                if (received === 0) {
                    const contentRange = response.headers.get('Content-Range');
                    if (contentRange) {
                        const match = contentRange.match(/\/(\d+)$/);
                        if (match) total = parseInt(match[1], 10);
                    } else {
                        total = parseInt(response.headers.get('Content-Length'), 10) || 0;
                    }
                    console.log("[Tel Download] Total size detected:", total);
                }

                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    received += value.length;

                    const percent = total ? (received / total) * 100 : Math.min(10 + (received / 1048576), 95);
                    updateProgressUI(percent, "Descargando", received / 1048576);
                }

                // Check if we have everything
                if (total && received >= total) {
                    isComplete = true;
                } else if (response.status === 200) {
                    // If it was a 200 (Full), we are done after reading the stream
                    isComplete = true;
                } else if (received === 0) {
                    // Safeguard
                    throw new Error("No se recibieron datos del servidor");
                }

                console.log(`[Tel Download] Received ${received}/${total || 'unknown'} bytes`);
            }

            updateProgressUI(98, "Ensamblando fragmentos...");
            const blob = new Blob(chunks, { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
            updateProgressUI(100, "¡Descarga Completa!");

        } catch (err) {
            console.error("[Tel Download] Multi-chunk fetch failed:", err);
            updateProgressUI(1, "Error de Segmento: " + err.message);
            setTimeout(() => document.getElementById("tmd-progress-container")?.remove(), 8000);
        }
    }

    // --- DOWNLOAD TRIGGERS ---

    function startDownload(url, filename) {
        // Logic to decide if we use Offscreen or In-page
        const isStream = url.includes("stream/") || url.startsWith("blob:");

        if (isStream) {
            fetchInPage(url, filename);
        } else {
            updateProgressUI(10, "Buscando motor externo...");
            window.dispatchEvent(new CustomEvent("TelDownloadEvent", {
                detail: { action: "download", data: { url, filename } }
            }));
        }
    }

    // --- RELAY LISTENERS (FOR EXTENSION MODE) ---

    window.addEventListener("TelExtensionProgress", (e) => {
        const { type, data } = e.detail;
        if (type === 'download-progress') {
            updateProgressUI(data.percent, data.status, data.mb);
        } else if (type === 'download-error') {
            updateProgressUI(1, "Error: " + data.error);
            setTimeout(() => document.getElementById("tmd-progress-container")?.remove(), 8000);
        }
    });

    // --- UI BUTTONS ---

    function createViewerBtn(onClick) {
        const btn = document.createElement("div");
        btn.className = "tmd-viewer-btn";
        btn.title = "Guardar Video";
        btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
        btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
        return btn;
    }

    function inject() {
        // Target Media Viewer Header
        const header = document.querySelector(".media-viewer-header, .media-viewer-buttons, .viewer-buttons");
        if (header && !header.querySelector(".tmd-viewer-btn")) {
            const video = document.querySelector("video");
            if (video && (video.src || video.currentSrc)) {
                const btn = createViewerBtn(() => {
                    const filename = "telegram_video_" + Date.now() + ".mp4";
                    createProgressBar(filename);
                    startDownload(video.currentSrc || video.src, filename);
                });
                header.insertBefore(btn, header.firstChild);
            }
        }

        // Target Chat Thumbnails (Simplified injection)
        const thumbs = document.querySelectorAll(".media-inner, .album-item-video, .media-video");
        thumbs.forEach(thumb => {
            if (thumb.querySelector(".tmd-dl-btn")) return;
            const isVideo = thumb.querySelector("video, .icon-play, .video-time");
            if (!isVideo) return;

            if (getComputedStyle(thumb).position === "static") thumb.style.position = "relative";
            const btn = document.createElement("div");
            btn.className = "tmd-dl-btn";
            btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';
            btn.onclick = (e) => {
                e.preventDefault(); e.stopPropagation();
                thumb.click(); // Open viewer first
            };
            thumb.appendChild(btn);
        });
    }

    setInterval(inject, 2000);
})();
