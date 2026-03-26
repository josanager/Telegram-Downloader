// offscreen.js – Misil v2.0 (Stable Assembler)

const buffers = new Map();

function getMimeType(filename) {
    const ext = (filename || '').split('.').pop().toLowerCase();
    const types = {
        mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif', webp: 'image/webp'
    };
    return types[ext] || 'application/octet-stream';
}

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
            const bytes = new Uint8Array(data.chunk);
            buffer.chunks.push(bytes);
        }
    }

    if (type === 'relay-end') {
        const buffer = buffers.get(data.downloadId);
        if (buffer) {
            const mime = getMimeType(buffer.filename);
            const blob = new Blob(buffer.chunks, { type: mime });
            const blobUrl = URL.createObjectURL(blob);

            chrome.runtime.sendMessage({
                type: 'download-complete',
                data: {
                    downloadId: data.downloadId,
                    blobUrl,
                    filename: buffer.filename
                }
            }).catch(() => {});

            buffers.delete(data.downloadId);
        }
    }

    if (type === 'relay-error') {
        buffers.delete(data.downloadId);
    }
});
