// inject.js – Misil v3.0 (Simple: Click → Download)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : '';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log('[Misil] v3.0 Simple Mode');

    // ── Download: fetch in page context, convert to blob URL, send to extension ──
    async function downloadMedia(url, filename) {
        try {
            console.log('[Misil] Fetching:', url.substring(0, 80) + '...');
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            const blobUrl = URL.createObjectURL(blob);
            console.log('[Misil] Blob ready, requesting download:', filename);

            // Send to extension for download via chrome.downloads API
            window.dispatchEvent(new CustomEvent('MisilDownload_' + extId, {
                detail: { blobUrl, filename }
            }));
        } catch (err) {
            console.error('[Misil] Download error:', err);
        }
    }

    // ── Viewer capture: open viewer, wait for URL, close, download ──
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

            const vid = viewer.querySelector('video');
            const img = viewer.querySelector('img.full-media, img:not(.thumbnail):not([class*="thumb"]):not([class*="avatar"])');

            let src = null;
            let foundVideo = false;
            if (vid) {
                src = vid.currentSrc || vid.src || '';
                if (src && src.length > 10 && src !== 'about:blank') {
                    foundVideo = true;
                } else {
                    src = null;
                }
            }
            if (!src && img) {
                src = img.src || '';
                if (!src || src.length < 10) src = null;
            }

            if (src) {
                clearInterval(watcher);

                // Fix extension based on actual content
                const actualFilename = foundVideo
                    ? filename.replace(/\.jpg$/, '.mp4')
                    : filename.replace(/\.mp4$/, '.jpg');

                // Close viewer
                const closeBtn = viewer.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
                if (closeBtn) closeBtn.click();
                else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));

                // Wait for close, then download
                setTimeout(() => downloadMedia(src, actualFilename), 500);
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

                btn.classList.add('tmd-dl-btn--pulse');
                setTimeout(() => btn.classList.remove('tmd-dl-btn--pulse'), 600);

                captureAndDownload(media, isVid);
            }, true);

            media.appendChild(btn);
        });
    }

    setInterval(inject, 1500);
    inject();
})();
