// offscreen.js - v22.0 (Stable Assembler)

console.log("[Offscreen] v22.0 Assembler Loaded");

const buffers = new Map();

chrome.runtime.onMessage.addListener((message) => {
    const { type, data } = message;

    if (type === 'relay-start') {
        buffers.set(data.downloadId, {
            filename: data.filename,
            chunks: []
        });
    }

    if (type === 'relay-chunk') {
        const buffer = buffers.get(data.downloadId);
        if (buffer) {
            // Decode Base64 back to Uint8Array (Zero data loss)
            const binary = atob(data.base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }
            buffer.chunks.push(bytes);
        }
    }

    if (type === 'relay-end') {
        const buffer = buffers.get(data.downloadId);
        if (buffer) {
            console.log("[Offscreen] Assembling final video:", buffer.filename);
            const blob = new Blob(buffer.chunks, { type: 'video/mp4' });
            const blobUrl = URL.createObjectURL(blob);

            chrome.runtime.sendMessage({
                type: 'download-complete',
                data: {
                    downloadId: data.downloadId,
                    blobUrl,
                    filename: buffer.filename
                }
            }).catch(() => { });

            buffers.delete(data.downloadId);
        }
    }

    if (type === 'relay-error') {
        buffers.delete(data.downloadId);
    }
});
