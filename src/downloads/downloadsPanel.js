// Downloads popup behaviour. A separate file because the page is served under a CSP that refuses
// inline script -- see src/utils/appProtocol.ts.

const api = window.downloadsAPI;
const list = document.getElementById('list');
const empty = document.getElementById('empty');
const rows = new Map();

function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }
    return `${value.toFixed(unit === 0 || value >= 100 ? 0 : 1)} ${units[unit]}`;
}

function formatEta(seconds) {
    const s = Math.round(seconds);
    if (s < 60) return `${s}s left`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s left`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m left`;
}

const join = (...parts) => parts.filter(Boolean).join(' · ');
const isActive = (item) => ['queued', 'downloading', 'processing'].includes(item.status);

function describe(item) {
    const track = item.count > 1 && item.index ? `Track ${item.index} of ${item.count}` : '';

    switch (item.status) {
        case 'queued':
            return 'Waiting…';
        case 'downloading':
            if (item.downloaded === null) return join(track, 'Starting…');
            return join(
                track,
                item.total
                    ? `${formatBytes(item.downloaded)} of ${formatBytes(item.total)}`
                    : formatBytes(item.downloaded),
                item.speed ? `${formatBytes(item.speed)}/s` : '',
                item.eta !== null ? formatEta(item.eta) : '',
            );
        case 'processing':
            return join(track, 'Finishing…');
        case 'done':
            return join(
                'Done',
                item.files > 1 ? `${item.files} tracks` : '',
                item.size ? formatBytes(item.size) : '',
                item.skipped.length ? `${item.skipped.length} skipped (${[...new Set(item.skipped)].join(', ')})` : '',
            );
        case 'cancelled':
            return 'Cancelled';
        default:
            return item.error || 'Failed';
    }
}

function createRow(item) {
    const row = document.createElement('div');
    row.dataset.id = item.id;

    const title = document.createElement('div');
    title.className = 'title';
    const button = document.createElement('button');
    button.type = 'button';
    const progress = document.createElement('progress');
    const detail = document.createElement('div');
    detail.className = 'detail';

    row.append(title, button, progress, detail);
    return row;
}

// Rows are updated in place: rebuilding them five times a second would swallow clicks on their buttons.
function render(items) {
    for (const [id, row] of rows) {
        if (!items.some((item) => item.id === id)) {
            row.remove();
            rows.delete(id);
        }
    }

    items.forEach((item, position) => {
        let row = rows.get(item.id);
        if (!row) {
            row = createRow(item);
            rows.set(item.id, row);
        }
        if (list.children[position] !== row) list.insertBefore(row, list.children[position] ?? null);

        const [title, button, progress, detail] = row.children;
        row.className = `row ${item.status}`;
        // textContent throughout: titles and error text come from soundcloud.com and yt-dlp
        title.textContent = item.title;
        title.title = item.title;
        detail.textContent = describe(item);

        progress.hidden = !isActive(item);
        if (item.status === 'downloading' && item.total) progress.value = (item.downloaded ?? 0) / item.total;
        else progress.removeAttribute('value');

        const action = isActive(item) ? 'downloads-cancel' : item.file ? 'downloads-show' : '';
        button.hidden = !action;
        button.dataset.action = action;
        button.textContent = isActive(item) ? 'Cancel' : 'Show';
        button.title = isActive(item) ? 'Cancel download' : 'Show in folder';
    });

    empty.hidden = items.length > 0;
}

list.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (button) api.send(button.dataset.action, Number(button.closest('.row').dataset.id));
});

document.getElementById('open-folder').addEventListener('click', () => api.send('downloads-open-folder'));
document.getElementById('clear').addEventListener('click', () => api.send('downloads-clear'));
document.getElementById('close').addEventListener('click', () => api.send('toggle-downloads'));

api.onChanged(render);
api.getDownloads().then(render);
