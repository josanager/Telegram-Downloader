// inject.js – Misil v3.1 (Click → Download, fixed cross-world messaging)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : '';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log('[Misil] v3.1 loaded');

    // ── Download: fetch in page context (has cookies), convert to dataURL, send to extension ──
    async function downloadMedia(url, filename) {
        try {
            console.log('[Misil] Fetching:', url.substring(0, 60));
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            console.log('[Misil] Blob size:', blob.size, 'type:', blob.type);

            // Convert blob to data URL (works for any size, just a string)
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result;
                console.log('[Misil] DataURL ready, sending to extension. Length:', dataUrl.length);
                // Send via postMessage (works across isolated worlds)
                window.postMessage({
                    type: 'MISIL_DOWNLOAD',
                    dataUrl: dataUrl,
                    filename: filename
                }, '*');
            };
            reader.readAsDataURL(blob);
        } catch (err) {
            console.error('[Misil] Download error:', err);
        }
    }

    // ── Open viewer, capture URL, close, download ──
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
                if (ticks > 60) clearInterval(watcher);
                return;
            }

            const vid = viewer.querySelector('video');
            const img = viewer.querySelector('img.full-media, img:not(.thumbnail):not([class*="thumb"]):not([class*="avatar"])');

            let src = null;
            let foundVideo = false;
            if (vid) {
                const s = vid.currentSrc || vid.src || '';
                if (s.length > 10 && s !== 'about:blank') { src = s; foundVideo = true; }
            }
            if (!src && img) {
                const s = img.src || '';
                if (s.length > 10) src = s;
            }

            if (src) {
                clearInterval(watcher);
                const actualFilename = foundVideo
                    ? filename.replace(/\.jpg$/, '.mp4')
                    : filename.replace(/\.mp4$/, '.jpg');

                // Close viewer
                const closeBtn = viewer.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
                if (closeBtn) closeBtn.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                setTimeout(() => downloadMedia(src, actualFilename), 600);
                return;
            }

            if (ticks > 60) {
                clearInterval(watcher);
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
            }
        }, 200);
    }

    // ── Inject buttons ──
    function inject() {
        document.querySelectorAll('.media-inner, .album-item, .media-photo').forEach(media => {
            if (media.dataset.misilDone) return;

            const hasVideo = !!media.querySelector('video, .video-time, .media-video-time, .icon-large-play, .icon-play');
            const hasImg = !hasVideo && !!media.querySelector('img');
            if (!hasVideo && !hasImg) return;

            media.dataset.misilDone = 'true';
            if (getComputedStyle(media).position === 'static') media.style.position = 'relative';

            const btn = document.createElement('div');
            btn.className = 'tmd-dl-btn';
            btn.innerHTML = `<div class="tmd-dl-hitarea"></div><img class="tmd-dl-icon" src="${iconUrl}" draggable="false" alt="Misil">`;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);
                captureAndDownload(media, hasVideo);
            }, true);

            media.appendChild(btn);
        });
    }

    setInterval(inject, 1500);
    inject();
})();
