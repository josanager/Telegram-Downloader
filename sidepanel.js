// sidepanel.js – Misil v2.0 (Dashboard)

document.addEventListener('DOMContentLoaded', async () => {
    // Load quota
    const state = await chrome.storage.local.get(['download_count']);
    updateQuota(state.download_count || 0);

    // Load history
    const historyData = await chrome.storage.local.get(['download_history']);
    renderHistory(historyData.download_history || []);

    // Listen for live updates from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'quota-update') {
            updateQuota(message.count);
        }
        if (message.type === 'history-updated') {
            renderHistory(message.history);
        }
    });
});

function updateQuota(count) {
    const limit = 100;
    document.getElementById('current-count').textContent = count;
    document.getElementById('remaining-count').textContent = Math.max(0, limit - count);

    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (count / limit) * circumference;
    document.getElementById('circle-fill').style.strokeDashoffset = offset;
}

function renderHistory(history) {
    const list = document.getElementById('history-list');
    const empty = document.getElementById('empty-state');

    if (!history || history.length === 0) {
        empty.style.display = 'block';
        // Clear any existing items except empty state
        list.querySelectorAll('.history-item').forEach(el => el.remove());
        return;
    }

    empty.style.display = 'none';
    // Clear previous items
    list.querySelectorAll('.history-item').forEach(el => el.remove());

    history.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';

        const isVideo = /\.(mp4|webm|mkv)$/i.test(item.name);
        const iconSvg = isVideo
            ? '<svg viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>'
            : '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';

        li.innerHTML = `
            <div class="history-icon">${iconSvg}</div>
            <div class="history-info">
                <div class="history-name" title="${item.name}">${item.name}</div>
                <div class="history-date">${item.date}</div>
            </div>
        `;
        list.appendChild(li);
    });
}
