// offscreen.js - The Download Engine (v17.4)

console.log("[Offscreen] Engine v17.4 Loaded");

chrome.runtime.onMessage.addListener(async (message) => {
    if (message.type === 'start-download') {
        const { url, filename, downloadId } = message.data;
        console.log("[Offscreen] Received start-download for:", filename);
        await startChunkedDownload(url, filename, downloadId);
    }
});

// Signal readiness to background
chrome.runtime.sendMessage({ type: 'offscreen-ready' });

async function startChunkedDownload(url, filename, downloadId) {
    try {
        console.log("[Offscreen] Multi-chunk fetch starting:", url);

        let received = 0;
        let total = 0;
        let chunks = [];
        let isComplete = false;

        while (!isComplete) {
            const headers = new Headers();
            if (received > 0) {
                headers.set('Range', `bytes=${received}-`);
            }

            const response = await fetch(url, {
                method: 'GET',
                headers: headers,
                credentials: 'include'
            });

            if (!response.ok && response.status !== 206) {
                throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
            }

            // Detect total size
            if (received === 0) {
                const contentRange = response.headers.get('Content-Range');
                if (contentRange) {
                    const match = contentRange.match(/\/(\d+)$/);
                    if (match) total = parseInt(match[1], 10);
                } else {
                    total = parseInt(response.headers.get('Content-Length'), 10) || 0;
                }
                console.log("[Offscreen] Total download size:", total);
            }

            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                received += value.length;

                // Throttle progress updates
                const percent = total ? (received / total) * 100 : 0;
                chrome.runtime.sendMessage({
                    type: 'download-progress',
                    data: {
                        downloadId,
                        percent: Math.min(percent, 99),
                        mb: received / 1048576,
                        status: 'Descargando'
                    }
                });
            }

            // Termination logic
            if (total && received >= total) {
                isComplete = true;
            } else if (response.status === 200) {
                // If the server ignored the Range header and sent the full file
                isComplete = true;
            } else if (received === 0) {
                throw new Error("Zero bytes received from server");
            }
        }

        console.log("[Offscreen] Final assembly...");
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        chrome.runtime.sendMessage({
            type: 'download-complete',
            data: {
                downloadId,
                blobUrl,
                filename
            }
        });

    } catch (error) {
        console.error("[Offscreen] Error:", error);
        chrome.runtime.sendMessage({
            type: 'download-error',
            data: {
                downloadId,
                error: "Error de motor: " + error.message
            }
        });
    }
}
