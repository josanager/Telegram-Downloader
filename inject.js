// inject.js – Misil v3.2 (Wait for full-res before capture)

(function () {
    const currentScript = document.currentScript;
    const extId = currentScript && currentScript.dataset.extId ? currentScript.dataset.extId : '';
    const iconUrl = currentScript && currentScript.dataset.iconUrl ? currentScript.dataset.iconUrl : '';
    console.log('[Misil] v3.2 loaded');

    // ── Download: fetch in page context, convert to dataURL, send to extension ──
    async function downloadMedia(url, filename) {
        try {
            console.log('[Misil] Fetching:', url.substring(0, 80));
            const resp = await fetch(url, { credentials: 'include' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const blob = await resp.blob();
            console.log('[Misil] Blob:', blob.size, 'bytes, type:', blob.type);

            // Reject if too small (thumbnail)
            if (blob.size < 50000 && blob.type.startsWith('image')) {
                console.warn('[Misil] File too small, likely thumbnail. Retrying...');
                return false; // Signal to retry
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                window.postMessage({
                    type: 'MISIL_DOWNLOAD',
                    dataUrl: reader.result,
                    filename: filename
                }, '*');
            };
            reader.readAsDataURL(blob);
            return true;
        } catch (err) {
            console.error('[Misil] Download error:', err);
            return false;
        }
    }

    // ── Viewer: open, wait for FULL-RES media, close, download ──
    function captureAndDownload(media, isVid) {
        const ext = isVid ? '.mp4' : '.jpg';
        const filename = 'telegram_' + (isVid ? 'video' : 'foto') + '_' + Date.now() + ext;

        // Click to open viewer
        const clickTarget = media.querySelector('img.full-media, video, img, .full-media') || media;
        clickTarget.click();

        let ticks = 0;
        let lastSrc = '';
        let stableTicks = 0; // How many ticks the src has been stable (unchanged)

        const watcher = setInterval(() => {
            ticks++;
            const viewer = document.querySelector('.media-viewer-whole, #MediaViewer, .media-viewer-movers');
            if (!viewer) {
                if (ticks > 80) clearInterval(watcher);
                return;
            }

            // For VIDEOS: look for a video with a real src
            if (isVid) {
                const vid = viewer.querySelector('video');
                if (vid) {
                    const s = vid.currentSrc || vid.src || '';
                    if (s.length > 10 && s !== 'about:blank') {
                        // Wait for the video to have some data loaded
                        if (vid.readyState >= 2 || stableTicks > 10) {
                            clearInterval(watcher);
                            closeViewer(viewer);
                            const vFilename = filename.replace(/\.jpg$/, '.mp4');
                            setTimeout(() => downloadMedia(s, vFilename), 600);
                            return;
                        }
                        if (s === lastSrc) stableTicks++;
                        else { lastSrc = s; stableTicks = 0; }
                    }
                }
            }

            // For PHOTOS: wait for full-res image (naturalWidth > 400)
            if (!isVid) {
                const imgs = viewer.querySelectorAll('img');
                let bestImg = null;
                let bestSize = 0;
                imgs.forEach(img => {
                    // Skip tiny icons, avatars, thumbnails
                    if (img.naturalWidth < 100 || img.naturalHeight < 100) return;
                    if (img.classList.contains('thumbnail') || img.className.includes('thumb')) return;
                    if (img.className.includes('avatar') || img.width < 50) return;
                    const size = img.naturalWidth * img.naturalHeight;
                    if (size > bestSize) {
                        bestSize = size;
                        bestImg = img;
                    }
                });

                if (bestImg && bestImg.naturalWidth > 400) {
                    const s = bestImg.src || '';
                    if (s.length > 10) {
                        // Wait a bit more for highest quality to load
                        if (s === lastSrc) stableTicks++;
                        else { lastSrc = s; stableTicks = 0; }

                        // Source stable for 1 second (5 ticks × 200ms) = full quality loaded
                        if (stableTicks >= 5) {
                            clearInterval(watcher);
                            closeViewer(viewer);
                            const pFilename = filename.replace(/\.mp4$/, '.jpg');
                            setTimeout(() => downloadMedia(s, pFilename), 600);
                            return;
                        }
                    }
                }
            }

            // Timeout after 16 seconds
            if (ticks > 80) {
                clearInterval(watcher);
                closeViewer(viewer);
            }
        }, 200);
    }

    function closeViewer(viewer) {
        const closeBtn = viewer.querySelector('.btn-icon.tgico-close, [class*="media-viewer-close"]');
        if (closeBtn) closeBtn.click();
        else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
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
