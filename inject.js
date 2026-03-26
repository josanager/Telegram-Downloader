// inject.js – Misil v3.0 (Simple: Click → Download)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : '';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log('[Misil] v3.0 Simple Mode');

    // ── Download helper: fetch blob in page context, then trigger <a> download ──
    async function downloadMedia(url, filename) {
        try {
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                a.remove();
                URL.revokeObjectURL(blobUrl);
            }, 5000);
        } catch (err) {
            console.error('[Misil] Download error:', err);
            alert('Misil: Error al descargar - ' + err.message);
        }
    }

    // ── Viewer capture: open viewer, wait for real URL, close, download ──
    function captureAndDownload(media, isVid) {
        const ext = isVid ? '.mp4' : '.jpg';
        const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

        // Click media to open viewer
        const clickTarget = media.querySelector('img.full-media, video, img, .full-media') || media;
        clickTarget.click();

        let ticks = 0;
        const watcher = setInterval(() => {
            ticks++;
            const viewer = document.querySelector('.media-viewer-whole, #MediaViewer, .media-viewer-movers');
            if (!viewer) {
                if (ticks > 60) { clearInterval(watcher); }
                return;
            }

            // Look for video or image in the viewer
            const vid = viewer.querySelector('video');
            const img = viewer.querySelector('img.full-media, img:not(.thumbnail):not([class*="thumb"]):not([class*="avatar"])');

            let src = null;
            if (vid) {
                src = vid.currentSrc || vid.src || '';
                if (!src || src.length < 10 || src === 'about:blank') src = null;
            }
            if (!src && img) {
                src = img.src || '';
                if (!src || src.length < 10) src = null;
            }

            if (src) {
                clearInterval(watcher);

                // Correct extension based on what we actually found
                const actualFilename = vid && (vid.currentSrc || vid.src)
                    ? filename.replace(/\.jpg$/, '.mp4')
                    : filename.replace(/\.mp4$/, '.jpg');

                // Close viewer
                const closeBtn = viewer.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
                if (closeBtn) closeBtn.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                // Wait for viewer to close, then download
                setTimeout(() => downloadMedia(src, actualFilename), 500);
                return;
            }

            // Timeout after 12 seconds
            if (ticks > 60) {
                clearInterval(watcher);
                // Close viewer
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
                alert('Misil: No se pudo capturar el archivo. Intenta de nuevo.');
            }
        }, 200);
    }

    // ── Inject buttons ──
    function inject() {
        const containers = document.querySelectorAll('.media-inner, .album-item, .media-photo');

        containers.forEach(media => {
            if (media.dataset.misilDone) return;

            const hasVideo = !!media.querySelector('video, .video-time, .media-video-time, .icon-large-play, .icon-play');
            const hasImg = !hasVideo && !!media.querySelector('img');
            if (!hasVideo && !hasImg) return;

            media.dataset.misilDone = 'true';
            if (getComputedStyle(media).position === 'static') media.style.position = 'relative';

            const isVid = hasVideo;

            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.innerHTML = `<div class="tmd-dl-hitarea"></div><img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();

                // Pulse effect
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);

                // Capture and download
                captureAndDownload(media, isVid);
            }, true);

            media.appendChild(btn);
        });
    }

    setInterval(inject, 1500);
    inject();
})();
