const inputText = document.getElementById('inputText');
const titleInput = document.getElementById('titleInput');
const prompterText = document.getElementById('prompter-text');
const startBtn = document.getElementById('startBtn');
const stepBackBtn = document.getElementById('stepBackBtn');
const stepForwardBtn = document.getElementById('stepForwardBtn');
const resetBtn = document.getElementById('resetBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const undockBtn = document.getElementById('undockBtn');
const toggleControlsBtn = document.getElementById('toggleControlsBtn');
const controls = document.getElementById('controls');
const speedInput = document.getElementById('speed');
const speedValue = document.getElementById('speedValue');
const fontSize = document.getElementById('fontSize');
const fontValue = document.getElementById('fontValue');
const container = document.getElementById('prompter-container');
const status = document.getElementById('status');
const completionBanner = document.getElementById('completion-banner');
const wordCountEl = document.getElementById('wordCount');
const durationEl = document.getElementById('duration');
const timerValueEl = document.getElementById('timerValue');

// Geçen süre sayacı
let elapsedSeconds = 0;
let timerInterval = null;

function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ':' + String(s).padStart(2, '0');
}
function renderTimer() { timerValueEl.textContent = formatTime(elapsedSeconds); }
function startTimer() {
    if (timerInterval) return;
    timerInterval = setInterval(() => {
        elapsedSeconds++;
        renderTimer();
    }, 1000);
}
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}
function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
    renderTimer();
}

// Kelime sayısı + güncel hız/font'a göre tahmini kaydırma süresi
function measureTextHeight(text, fontSizePx) {
    let measurer = document.getElementById('textMeasurer');
    if (!measurer) {
        measurer = document.createElement('div');
        measurer.id = 'textMeasurer';
        measurer.style.cssText =
            'position:absolute;visibility:hidden;left:-9999px;top:0;' +
            'line-height:1.6;text-align:center;white-space:pre-wrap;';
        document.body.appendChild(measurer);
    }
    // Prompter metin alanının içerik genişliğini aynen uygula (her iki yanda 50px padding)
    const width = Math.max(200, container.clientWidth - 100);
    measurer.style.width = width + 'px';
    measurer.style.fontSize = fontSizePx + 'px';
    measurer.innerHTML = formatText(text);
    return measurer.offsetHeight;
}

// Basit inline biçimlendirme:
//   **kalın**                     -> <b>kalın</b>
//   {red:metin} {#ffcc00:vurgu}   -> <span style="color:..">metin</span>
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatText(raw) {
    let s = escapeHtml(raw || '');
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, '<b>$1</b>');
    s = s.replace(/\{([a-zA-Z]+|#[0-9a-fA-F]{3,8}):([\s\S]+?)\}/g,
        '<span style="color:$1">$2</span>');
    return s;
}

function updateStats() {
    const text = inputText.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    wordCountEl.textContent = words.toLocaleString('en-US');

    if (!words) {
        durationEl.textContent = '0:00';
        return;
    }

    const fontSizeVal = parseInt(fontSize.value);
    const speed = parseFloat(speedInput.value);
    const textHeight = measureTextHeight(text, fontSizeVal);
    const lineHeight = fontSizeVal * 1.6;
    const containerHeight = container.clientHeight || window.innerHeight;
    // Başlangıç: ekranın ortası. Bitiş: son satır üstte sabit.
    const startY = containerHeight / 2;
    const endY = -(textHeight - lineHeight);
    const totalDistance = startY - endY;
    const pixelsPerSecond = speed * 60; // requestAnimationFrame ~60 fps
    const totalSec = Math.max(0, Math.round(totalDistance / pixelsPerSecond));

    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    durationEl.textContent = m + ':' + String(s).padStart(2, '0');
}

let isPlaying = false;
let currentPosition = 0;
let animationId = null;
let statusTimeout = null;

function showStatus(text, type = 'playing') {
    status.textContent = text;
    status.className = 'show ' + type;
    clearTimeout(statusTimeout);
    statusTimeout = setTimeout(() => status.classList.remove('show'), 1200);
}

// Varsayılan başlangıç konumu — metnin ilk satırı ekranın tam ortasında
function getStartPosition() {
    return container.clientHeight / 2;
}

// Metni yeni container ölçüsüne göre ortaya al (undock/dock veya resize sonrası)
function recenterText() {
    if (!prompterText.textContent.trim()) return;
    currentPosition = getStartPosition();
    prompterText.style.top = currentPosition + 'px';
    completionBanner.classList.remove('show');
}

function loadText() {
    prompterText.innerHTML = formatText(inputText.value);
    currentPosition = getStartPosition();
    prompterText.style.top = currentPosition + 'px';
    isPlaying = false;
    cancelAnimationFrame(animationId);
    resetTimer();
    startBtn.textContent = '▶ Start';
    startBtn.classList.remove('stop');
    completionBanner.classList.remove('show');
    showStatus('Loaded', 'playing');
}


function scrollText() {
    if (!isPlaying) return;
    const speed = parseFloat(speedInput.value);
    currentPosition -= speed;

    // Son satırı ekranın en üstünde sabitle
    const textHeight = prompterText.clientHeight;
    const lineHeight = parseInt(fontSize.value) * 1.6;
    const minPosition = -(textHeight - lineHeight);

    if (currentPosition <= minPosition) {
        currentPosition = minPosition;
        prompterText.style.top = currentPosition + 'px';
        isPlaying = false;
        stopTimer();
        startBtn.textContent = '▶ Start';
        startBtn.classList.remove('stop');
        completionBanner.classList.add('show');
        showStatus('✓ Completed', 'playing');
        return;
    }

    prompterText.style.top = currentPosition + 'px';
    animationId = requestAnimationFrame(scrollText);
}

function togglePlay() {
    if (prompterText.textContent.trim() === '') {
        if (inputText.value.trim() !== '') loadText();
        else return;
    }
    // İlk başlatmada (top boş) metni yerleştir
    if (prompterText.style.top === '') {
        currentPosition = getStartPosition();
        prompterText.style.top = currentPosition + 'px';
    }
    isPlaying = !isPlaying;
    if (isPlaying) {
        completionBanner.classList.remove('show');
        animationId = requestAnimationFrame(scrollText);
        startTimer();
        startBtn.textContent = '⏸ Stop';
        startBtn.classList.add('stop');
        showStatus('▶ Playing', 'playing');
    } else {
        cancelAnimationFrame(animationId);
        stopTimer();
        startBtn.textContent = '▶ Start';
        startBtn.classList.remove('stop');
        showStatus('⏸ Paused', 'paused');
    }
}

// Bir satır kadar ileri/geri al (font boyutuna göre)
function step(direction) {
    if (prompterText.style.top === '') {
        currentPosition = getStartPosition();
    }
    const stepSize = parseInt(fontSize.value) * 1.6; // 1 satır yüksekliği
    currentPosition += direction * stepSize;
    prompterText.style.top = currentPosition + 'px';
    showStatus(direction > 0 ? '◀ 1 line back' : '1 line forward ▶', 'paused');
}

function resetPosition() {
    isPlaying = false;
    cancelAnimationFrame(animationId);
    resetTimer();
    currentPosition = getStartPosition();
    prompterText.style.top = currentPosition + 'px';
    startBtn.textContent = '▶ Start';
    startBtn.classList.remove('stop');
    completionBanner.classList.remove('show');
    showStatus('Reset to start', 'paused');
}

// Hız ve font boyutu tercihleri — localStorage'ta saklanır
const PREFS_KEY = 'prompterPrefs_v1';
function savePrefs() {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            speed: parseFloat(speedInput.value),
            fontSize: parseInt(fontSize.value)
        }));
    } catch (e) {}
}
function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return {
            speed: typeof data.speed === 'number' ? data.speed : null,
            fontSize: typeof data.fontSize === 'number' ? data.fontSize : null
        };
    } catch (e) { return null; }
}

function setSpeed(val) {
    const v = Math.max(0.4, Math.min(8, val));
    speedInput.value = v;
    speedValue.textContent = v.toFixed(1);
    updateStats();
    savePrefs();
}

function setFont(val) {
    const v = Math.max(20, Math.min(200, val));
    fontSize.value = v;
    fontValue.textContent = v;
    prompterText.style.fontSize = v + 'px';
    updateStats();
    savePrefs();
}

function toggleControls() {
    controls.classList.toggle('collapsed');
    const collapsed = controls.classList.contains('collapsed');
    toggleControlsBtn.textContent = collapsed ? '▼ Show' : '▲ Hide';
    showStatus(collapsed ? 'Panel hidden' : 'Panel shown', 'paused');
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        document.exitFullscreen();
    }
}

// ---- Undock / Dock ----
let pipWindow = null;
let popupWindow = null;
const containerOriginalParent = container.parentNode;

function setUndocked(isUndocked) {
    undockBtn.textContent = isUndocked ? '⧉ Dock' : '⧉ Undock';
    if(isUndocked) undockBtn.classList.add('undock'); else undockBtn.classList.remove('undock');

    undockBtn.title = isUndocked
        ? 'Dock back to main window (U)'
        : 'Open in separate window (U)';
}

function dockBack() {
    if (pipWindow && !pipWindow.closed) {
        pipWindow.close();
        pipWindow = null;
    }
    if (popupWindow && !popupWindow.closed) {
        popupWindow.close();
        popupWindow = null;
    }
    if (container.parentNode !== containerOriginalParent) {
        containerOriginalParent.appendChild(container);
    }
    // Ana pencereye geri döndüğünde metni yeniden ortaya al
    requestAnimationFrame(recenterText);
    setUndocked(false);
    showStatus('Docked to main window', 'paused');
}

async function undock() {
    if (pipWindow || popupWindow) { dockBack(); return; }

    // Öncelik: Document Picture-in-Picture (her zaman üstte durur — Meet/Zoom için ideal)
    if ('documentPictureInPicture' in window) {
        try {
            pipWindow = await documentPictureInPicture.requestWindow({
                width: 700,
                height: 450
            });

            // Ana penceredeki stilleri kopyala
            [...document.styleSheets].forEach(sheet => {
                try {
                    const css = [...sheet.cssRules].map(r => r.cssText).join('\n');
                    const style = pipWindow.document.createElement('style');
                    style.textContent = css;
                    pipWindow.document.head.appendChild(style);
                } catch (e) {
                    const link = pipWindow.document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = sheet.href;
                    pipWindow.document.head.appendChild(link);
                }
            });
            pipWindow.document.body.style.cssText =
                'margin:0;background:#121212;color:#fff;height:100vh;overflow:hidden;font-family:Segoe UI,sans-serif;';

            // Prompter container'ı PiP penceresine taşı
            pipWindow.document.body.appendChild(container);

            // PiP layout oturduktan sonra metni yeni container ölçüsüne göre ortaya al
            requestAnimationFrame(() => requestAnimationFrame(recenterText));

            // PiP penceresine odaklanıldığında klavye ve fare kısayolları çalışsın
            pipWindow.document.addEventListener('keydown', handleKeydown);
            pipWindow.document.addEventListener('wheel', handleWheel, { passive: false });

            pipWindow.addEventListener('pagehide', (e) => {
                const win = e.target.defaultView;
                if (win) {
                    win.document.removeEventListener('keydown', handleKeydown);
                    win.document.removeEventListener('wheel', handleWheel);
                }
                if (container.parentNode !== containerOriginalParent) {
                    containerOriginalParent.appendChild(container);
                }
                // Ana pencereye geri dönüldüğünde metni yeniden ortaya al
                requestAnimationFrame(recenterText);
                pipWindow = null;
                setUndocked(false);
            });

            setUndocked(true);
            showStatus('In separate window (PiP)', 'playing');
        } catch (err) {
            console.error(err);
            openPopupFallback();
        }
    } else {
        openPopupFallback();
    }
}

function openPopupFallback() {
    // Araç çubuklarından arındırılmış popup
    const features = 'popup=yes,toolbar=no,location=no,menubar=no,status=no,' +
                        'scrollbars=no,resizable=yes,width=700,height=450';
    popupWindow = window.open('', 'prompterPopup', features);
    if (!popupWindow) {
        alert('Popup blocked. Please allow popups in your browser settings.');
        return;
    }

    popupWindow.document.open();
    popupWindow.document.write('<!DOCTYPE html><html><head><title>Prompter</title></head><body></body></html>');
    popupWindow.document.close();

    // Stilleri kopyala
    [...document.styleSheets].forEach(sheet => {
        try {
            const css = [...sheet.cssRules].map(r => r.cssText).join('\n');
            const style = popupWindow.document.createElement('style');
            style.textContent = css;
            popupWindow.document.head.appendChild(style);
        } catch (e) {}
    });
    popupWindow.document.body.style.cssText =
        'margin:0;background:#121212;color:#fff;height:100vh;overflow:hidden;font-family:Segoe UI,sans-serif;';

    popupWindow.document.body.appendChild(container);

    // Popup layout oturduktan sonra metni yeni container ölçüsüne göre ortaya al
    requestAnimationFrame(() => requestAnimationFrame(recenterText));

    // Popup'a odaklanıldığında klavye ve fare kısayolları çalışsın
    popupWindow.document.addEventListener('keydown', handleKeydown);
    popupWindow.document.addEventListener('wheel', handleWheel, { passive: false });

    popupWindow.addEventListener('beforeunload', () => {
        popupWindow.document.removeEventListener('keydown', handleKeydown);
        popupWindow.document.removeEventListener('wheel', handleWheel);
        if (container.parentNode !== containerOriginalParent) {
            containerOriginalParent.appendChild(container);
        }
        // Ana pencereye geri dönüldüğünde metni yeniden ortaya al
        requestAnimationFrame(recenterText);
        popupWindow = null;
        setUndocked(false);
    });

    setUndocked(true);
    showStatus('Opened in separate window', 'playing');
}

// Buton olayları
// Auto-save: başlık veya metin değiştiğinde aktif içeriğe otomatik kaydet (debounce)
let autoSaveTimer = null;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        const p = currentProfile();
        if (!p) return;
        // Aktif içerik yoksa oluştur; varsa güncelle
        let tpl = p.activeTemplateId ? p.templates.find(t => t.id === p.activeTemplateId) : null;
        if (!tpl) {
            if (!titleInput.value.trim() && !inputText.value.trim()) return;
            tpl = { id: newTemplateId(), title: '', text: '' };
            p.templates.push(tpl);
            p.activeTemplateId = tpl.id;
        }
        tpl.title = titleInput.value;
        tpl.text = inputText.value;
        saveToStorage();
        renderTemplates();
        loadText();
        showStatus('💾 Auto-saved & loaded', 'playing');
    }, 600);
}
titleInput.addEventListener('input', scheduleAutoSave);
inputText.addEventListener('input', scheduleAutoSave);
startBtn.addEventListener('click', togglePlay);
stepBackBtn.addEventListener('click', () => step(1));    // metni aşağı kaydır = içerik geri gelir
stepForwardBtn.addEventListener('click', () => step(-1)); // metni yukarı kaydır = ileri gider
resetBtn.addEventListener('click', resetPosition);
fullscreenBtn.addEventListener('click', toggleFullscreen);
undockBtn.addEventListener('click', undock);
toggleControlsBtn.addEventListener('click', toggleControls);

speedInput.addEventListener('input', e => setSpeed(parseFloat(e.target.value)));
fontSize.addEventListener('input', e => setFont(parseInt(e.target.value)));
inputText.addEventListener('input', updateStats);

// ---- Profiles & Templates ----
const templatesPanel = document.getElementById('templatesPanel');
const templatesBtn = document.getElementById('templatesBtn');
const templatesCloseBtn = document.getElementById('templatesCloseBtn');
const templatesList = document.getElementById('templatesList');
const newTemplateBtn = document.getElementById('newTemplateBtn');
const activeTemplateIndicator = document.getElementById('activeTemplateIndicator');
const profileSelect = document.getElementById('profileSelect');
const newProfileBtn = document.getElementById('newProfileBtn');
const renameProfileBtn = document.getElementById('renameProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');

const STORAGE_KEY = 'prompterTemplates_v2';
const STORAGE_KEY_V1 = 'prompterTemplates_v1';

let profiles = [];
let activeProfileId = null;

function currentProfile() {
    return profiles.find(p => p.id === activeProfileId) || null;
}

function newProfileId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function newTemplateId() {
    return 't_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

function createProfile(name) {
    return {
        id: newProfileId(),
        name: name || 'New Profile',
        templates: [],
        activeTemplateId: null
    };
}

// En az bir profil daima var olmalı; aktif profil geçersizse ilki seçilir
function ensureAtLeastOneProfile() {
    if (profiles.length === 0) {
        const p = createProfile('Default');
        profiles.push(p);
        activeProfileId = p.id;
    }
    if (!currentProfile()) activeProfileId = profiles[0].id;
}

function loadFromStorage() {
    // Önce v2 formatını dene
    try {
        const rawV2 = localStorage.getItem(STORAGE_KEY);
        if (rawV2) {
            const data = JSON.parse(rawV2);
            profiles = Array.isArray(data.profiles) ? data.profiles : [];
            // Eksik alanları tamamla
            profiles = profiles.map(p => ({
                id: typeof p.id === 'string' ? p.id : newProfileId(),
                name: typeof p.name === 'string' ? p.name : 'Profile',
                templates: Array.isArray(p.templates) ? p.templates : [],
                activeTemplateId: typeof p.activeTemplateId === 'string' ? p.activeTemplateId : null
            }));
            activeProfileId = data.activeProfileId || null;
            ensureAtLeastOneProfile();
            return;
        }
    } catch (e) { profiles = []; }

    // v1 -> v2 migration: eski flat template listesini "Default" profiline sar
    try {
        const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
        if (rawV1) {
            const data = JSON.parse(rawV1);
            const def = createProfile('Default');
            def.templates = Array.isArray(data.templates) ? data.templates : [];
            def.activeTemplateId = data.activeId || null;
            profiles = [def];
            activeProfileId = def.id;
            saveToStorage();
            return;
        }
    } catch (e) {}

    ensureAtLeastOneProfile();
}

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        profiles,
        activeProfileId
    }));
}

function renderProfileSelect() {
    profileSelect.innerHTML = '';
    profiles.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        if (p.id === activeProfileId) opt.selected = true;
        profileSelect.appendChild(opt);
    });
}

// Aktif profilin son aktif şablonunu UI'a yükle; yoksa içerikleri temizle
function loadActiveTemplateOfProfile() {
    const p = currentProfile();
    if (!p) return;
    if (p.activeTemplateId) {
        const tpl = p.templates.find(t => t.id === p.activeTemplateId);
        if (tpl) {
            titleInput.value = tpl.title || '';
            inputText.value = tpl.text || '';
            updateStats();
            loadText();
            return;
        }
    }
    titleInput.value = '';
    inputText.value = '';
    prompterText.textContent = '';
    updateStats();
}

function switchProfile(id) {
    if (!profiles.find(p => p.id === id)) return;
    activeProfileId = id;
    saveToStorage();
    renderProfileSelect();
    renderTemplates();
    loadActiveTemplateOfProfile();
    showStatus('📁 ' + currentProfile().name, 'playing');
}

async function addNewProfile() {
    const name = await promptModal({
        title: '📁 New Profile',
        label: 'Profile name',
        value: 'Profile ' + (profiles.length + 1),
        okText: 'Create'
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const p = createProfile(trimmed);
    profiles.push(p);
    activeProfileId = p.id;
    titleInput.value = '';
    inputText.value = '';
    prompterText.textContent = '';
    updateStats();
    saveToStorage();
    renderProfileSelect();
    renderTemplates();
    showStatus('📁 + ' + p.name, 'playing');
}

async function renameActiveProfile() {
    const p = currentProfile();
    if (!p) return;
    const name = await promptModal({
        title: '✎ Rename Profile',
        label: 'New name',
        value: p.name,
        okText: 'Rename'
    });
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    p.name = trimmed;
    saveToStorage();
    renderProfileSelect();
    updateActiveIndicator();
    showStatus('📁 ' + p.name, 'playing');
}

function deleteActiveProfile() {
    const p = currentProfile();
    if (!p) return;

    // Son profil siliniyorsa: her şeyi temizle, "Default Profile" ile sıfırdan başla
    if (profiles.length <= 1) {
        if (!confirm(`Delete profile "${p.name}" and all its contents?\nEverything will be reset to a fresh "Default Profile".`)) return;
        profiles.length = 0;
        const fresh = createProfile('Default Profile');
        profiles.push(fresh);
        activeProfileId = fresh.id;
        inputText.value = '';
        titleInput.value = '';
        prompterText.innerHTML = '';
        saveToStorage();
        renderProfileSelect();
        renderTemplates();
        updateActiveIndicator();
        showStatus('🗑 Reset to Default Profile', 'paused');
        return;
    }

    if (!confirm(`Delete profile "${p.name}" and all its contents?`)) return;
    const idx = profiles.findIndex(x => x.id === p.id);
    profiles.splice(idx, 1);
    activeProfileId = profiles[Math.max(0, idx - 1)].id;
    saveToStorage();
    renderProfileSelect();
    renderTemplates();
    loadActiveTemplateOfProfile();
    showStatus('🗑 Profile deleted', 'paused');
}

function renderTemplates() {
    templatesList.innerHTML = '';
    const p = currentProfile();
    if (!p) { updateActiveIndicator(); return; }

    if (p.templates.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'tp-empty';
        empty.innerHTML = 'No contents in this profile.<br>Fill in title + text,<br>then wait for auto-save.';
        templatesList.appendChild(empty);
        updateActiveIndicator();
        return;
    }

    p.templates.forEach((tpl, idx) => {
        const item = document.createElement('div');
        item.className = 'tp-item' + (tpl.id === p.activeTemplateId ? ' active' : '');
        item.draggable = true;
        item.dataset.id = tpl.id;

        const snippet = (tpl.text || '').replace(/\s+/g, ' ').slice(0, 60);

        item.innerHTML = `
            <span class="tp-handle" title="Drag to reorder">⋮⋮</span>
            <div class="tp-info">
                <div class="tp-title"><span class="tp-index">${idx + 1}:</span> ${escapeHtml(tpl.title || '(untitled)')}</div>
                <div class="tp-snippet">${escapeHtml(snippet) || '<i>empty</i>'}</div>
            </div>
            <div class="tp-btns">
                <button class="tp-load" title="Load to prompter">▶</button>
                <button class="tp-edit" title="Update with current">⟳</button>
                <button class="tp-del" title="Delete">×</button>
            </div>
        `;

        item.querySelector('.tp-load').addEventListener('click', (e) => {
            e.stopPropagation();
            activateTemplate(tpl.id);
        });
        item.querySelector('.tp-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            tpl.title = titleInput.value;
            tpl.text = inputText.value;
            saveToStorage();
            renderTemplates();
            showStatus('Content updated', 'playing');
        });
        item.querySelector('.tp-del').addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm('Delete this content?')) return;
            const i = p.templates.findIndex(t => t.id === tpl.id);
            if (i >= 0) p.templates.splice(i, 1);
            if (p.activeTemplateId === tpl.id) p.activeTemplateId = null;
            saveToStorage();
            renderTemplates();
        });
        item.addEventListener('click', () => activateTemplate(tpl.id));

        // Drag & drop reordering
        item.addEventListener('dragstart', (e) => {
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', tpl.id);
        });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            item.classList.add('drag-over');
        });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over');
            const draggedId = e.dataTransfer.getData('text/plain');
            if (!draggedId || draggedId === tpl.id) return;
            const from = p.templates.findIndex(t => t.id === draggedId);
            const to = p.templates.findIndex(t => t.id === tpl.id);
            if (from < 0 || to < 0) return;
            const [moved] = p.templates.splice(from, 1);
            p.templates.splice(to, 0, moved);
            saveToStorage();
            renderTemplates();
        });

        templatesList.appendChild(item);
    });
    updateActiveIndicator();
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
}

function updateActiveIndicator() {
    const p = currentProfile();
    if (!p) { activeTemplateIndicator.textContent = ''; return; }
    // Birden fazla profil varsa profil adını da göster
    const profilePrefix = profiles.length > 1 ? p.name : '';
    if (p.templates.length === 0 || !p.activeTemplateId) {
        activeTemplateIndicator.textContent = profilePrefix;
        return;
    }
    const idx = p.templates.findIndex(t => t.id === p.activeTemplateId);
    if (idx < 0) { activeTemplateIndicator.textContent = profilePrefix; return; }
    const tpl = p.templates[idx];
    const tplPart = `📋 ${tpl.title || '(untitled)'}  —  ${idx + 1} / ${p.templates.length}`;
    activeTemplateIndicator.textContent = profilePrefix
        ? `${profilePrefix}  /  ${tplPart}`
        : tplPart;
}

function activateTemplate(id) {
    const p = currentProfile();
    if (!p) return;
    const tpl = p.templates.find(t => t.id === id);
    if (!tpl) return;
    p.activeTemplateId = id;
    titleInput.value = tpl.title || '';
    inputText.value = tpl.text || '';
    updateStats();
    loadText();
    saveToStorage();
    renderTemplates();
    showStatus('📋 ' + (tpl.title || 'Content loaded'), 'playing');
}

function saveCurrentAsTemplate() {
    const p = currentProfile();
    if (!p) return;
    // Aktif bir şablon varsa onu güncelle — yeni şablon oluşturma
    if (p.activeTemplateId) {
        const tpl = p.templates.find(t => t.id === p.activeTemplateId);
        if (tpl) {
            tpl.title = titleInput.value;
            tpl.text = inputText.value;
            saveToStorage();
            renderTemplates();
            showStatus('💾 Content updated', 'playing');
            return;
        }
    }
    // Aktif şablon yoksa: mevcut içerikle yeni şablon oluştur
    const tpl = {
        id: newTemplateId(),
        title: titleInput.value,
        text: inputText.value
    };
    p.templates.push(tpl);
    p.activeTemplateId = tpl.id;
    saveToStorage();
    renderTemplates();
    showStatus('💾 Content saved', 'playing');
}

// Tek adımda: aktif şablona kaydet + prompter ekranına al
function saveAndLoad() {
    saveCurrentAsTemplate();
    loadText();
    showStatus('💾 Saved & loaded', 'playing');
}

function addEmptyTemplate() {
    const p = currentProfile();
    if (!p) return;
    const tpl = {
        id: newTemplateId(),
        title: '',
        text: ''
    };
    p.templates.push(tpl);
    p.activeTemplateId = tpl.id;
    titleInput.value = '';
    inputText.value = '';
    updateStats();
    loadText();
    saveToStorage();
    renderTemplates();
    showStatus('+ New empty content', 'playing');
}

function cycleTemplate(direction) {
    const p = currentProfile();
    if (!p || p.templates.length === 0) return;
    let idx = p.templates.findIndex(t => t.id === p.activeTemplateId);
    if (idx < 0) idx = 0;
    else idx = (idx + direction + p.templates.length) % p.templates.length;
    activateTemplate(p.templates[idx].id);
}

function toggleTemplatesPanel() {
    templatesPanel.classList.toggle('open');
}

templatesBtn.addEventListener('click', toggleTemplatesPanel);
templatesCloseBtn.addEventListener('click', toggleTemplatesPanel);
newTemplateBtn.addEventListener('click', addEmptyTemplate);
document.getElementById('newContentBtn').addEventListener('click', () => {
    // Aktif içerik zaten boşsa yenisini oluşturma
    const p = currentProfile();
    const active = p && p.templates.find(t => t.id === p.activeTemplateId);
    const titleEmpty = !titleInput.value.trim();
    const textEmpty = !inputText.value.trim();
    if (titleEmpty && textEmpty && active && !(active.title || '').trim() && !(active.text || '').trim()) {
        showStatus('Already on an empty content', 'paused');
        titleInput.focus();
        return;
    }
    addEmptyTemplate();
    titleInput.focus();
});
profileSelect.addEventListener('change', (e) => switchProfile(e.target.value));
newProfileBtn.addEventListener('click', addNewProfile);
renameProfileBtn.addEventListener('click', renameActiveProfile);
deleteProfileBtn.addEventListener('click', deleteActiveProfile);

// ---- Export / Import ----
const exportTemplatesBtn = document.getElementById('exportTemplatesBtn');
const importTemplatesBtn = document.getElementById('importTemplatesBtn');
const importTemplatesInput = document.getElementById('importTemplatesInput');

function exportTemplates() {
    // Tüm profiller + içindeki şablonlar
    if (profiles.length === 0) {
        alert('No profiles to export.');
        return;
    }
    const payload = {
        app: 'prompter',
        version: 2,
        exportedAt: new Date().toISOString(),
        activeProfileId: activeProfileId,
        profiles: profiles.map(p => ({
            id: p.id,
            name: p.name,
            activeTemplateId: p.activeTemplateId || null,
            templates: p.templates.map(t => ({
                id: t.id,
                title: t.title || '',
                text: t.text || ''
            }))
        }))
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `prompter-profiles-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    const tplCount = profiles.reduce((n, p) => n + p.templates.length, 0);
    showStatus(`⬇ Exported ${profiles.length} profile(s), ${tplCount} content(s)`, 'playing');
}

function importTemplates(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);

            // v2 formatı: profil listesi
            if (parsed && Array.isArray(parsed.profiles)) {
                importProfilesList(parsed.profiles, parsed.activeProfileId);
                return;
            }

            // v1 veya düz template listesi: aktif profile ekle/değiştir
            let incoming = [];
            if (Array.isArray(parsed)) incoming = parsed;
            else if (parsed && Array.isArray(parsed.templates)) incoming = parsed.templates;
            else if (parsed && (parsed.title !== undefined || parsed.text !== undefined)) incoming = [parsed];

            if (incoming.length === 0) {
                alert('No valid contents or profiles found in file.');
                return;
            }
            importFlatTemplates(incoming);
        } catch (err) {
            alert('Invalid JSON file:\n' + err.message);
        }
    };
    reader.readAsText(file);
}

function importProfilesList(incomingProfiles, incomingActiveId) {
    const mode = confirm(
        `Found ${incomingProfiles.length} profile(s).\n\n` +
        'OK  = Merge (add to existing profiles)\n' +
        'Cancel = Replace (overwrite all current profiles)'
    );

    const existingProfileIds = new Set(profiles.map(p => p.id));
    const normalized = incomingProfiles.map(p => {
        let id = typeof p.id === 'string' ? p.id : '';
        if (!id || existingProfileIds.has(id)) id = newProfileId();
        existingProfileIds.add(id);
        const tpls = Array.isArray(p.templates) ? p.templates : [];
        const seenTplIds = new Set();
        const normTpls = tpls.map(t => {
            let tid = typeof t.id === 'string' ? t.id : '';
            if (!tid || seenTplIds.has(tid)) tid = newTemplateId();
            seenTplIds.add(tid);
            return {
                id: tid,
                title: typeof t.title === 'string' ? t.title : '',
                text: typeof t.text === 'string' ? t.text : ''
            };
        });
        return {
            id,
            name: (typeof p.name === 'string' && p.name.trim()) ? p.name : 'Imported Profile',
            templates: normTpls,
            activeTemplateId: typeof p.activeTemplateId === 'string' ? p.activeTemplateId : null
        };
    });

    if (mode) {
        profiles.push(...normalized);
        showStatus('⬆ Imported ' + normalized.length + ' profile(s)', 'playing');
    } else {
        profiles.length = 0;
        profiles.push(...normalized);
        showStatus('⬆ Replaced with ' + normalized.length + ' profile(s)', 'playing');
    }
    // Import sonrası: import edilen ilk profili ve o profilin ilk içeriğini aktif seç
    const firstImported = normalized[0];
    if (firstImported) {
        activeProfileId = firstImported.id;
        if (firstImported.templates.length > 0) {
            firstImported.activeTemplateId = firstImported.templates[0].id;
        }
    }
    ensureAtLeastOneProfile();
    saveToStorage();
    renderProfileSelect();
    renderTemplates();
    loadActiveTemplateOfProfile();
}

function importFlatTemplates(incoming) {
    const p = currentProfile();
    if (!p) return;
    const mode = confirm(
        `Found ${incoming.length} content(s).\n\n` +
        `OK  = Merge into current profile "${p.name}"\n` +
        `Cancel = Replace contents in profile "${p.name}"`
    );

    const existingIds = new Set(p.templates.map(t => t.id));
    const normalized = incoming.map(t => {
        let id = typeof t.id === 'string' ? t.id : '';
        if (!id || existingIds.has(id)) id = newTemplateId();
        existingIds.add(id);
        return {
            id,
            title: typeof t.title === 'string' ? t.title : '',
            text: typeof t.text === 'string' ? t.text : ''
        };
    });

    if (mode) {
        p.templates.push(...normalized);
        showStatus('⬆ Imported ' + normalized.length + ' content(s)', 'playing');
    } else {
        p.templates.length = 0;
        p.templates.push(...normalized);
        showStatus('⬆ Replaced with ' + normalized.length + ' content(s)', 'playing');
    }
    // Import edilen ilk içeriği aktif seç ve yükle
    if (normalized.length > 0) {
        p.activeTemplateId = normalized[0].id;
    }
    saveToStorage();
    renderTemplates();
    loadActiveTemplateOfProfile();
}

exportTemplatesBtn.addEventListener('click', exportTemplates);
importTemplatesBtn.addEventListener('click', () => importTemplatesInput.click());
importTemplatesInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importTemplates(file);
    e.target.value = ''; // aynı dosyayı tekrar seçebilmek için sıfırla
});

loadFromStorage();
renderProfileSelect();
renderTemplates();
// Son aktif profilin aktif şablonunu otomatik yükle.
// Aktif şablon yoksa ve profilde içerik varsa, ilk içeriği aktif seç.
const bootProfile = currentProfile();
if (bootProfile) {
    let tpl = null;
    if (bootProfile.activeTemplateId) {
        tpl = bootProfile.templates.find(t => t.id === bootProfile.activeTemplateId) || null;
    }
    if (!tpl && bootProfile.templates.length > 0) {
        tpl = bootProfile.templates[0];
        bootProfile.activeTemplateId = tpl.id;
        saveToStorage();
        renderTemplates();
    }
    if (tpl) {
        titleInput.value = tpl.title || '';
        inputText.value = tpl.text || '';
        updateActiveIndicator && updateActiveIndicator();
        updateStats();
        loadText();
    } else {
        // Hiç içerik yoksa hoş geldin mesajı göster
        showWelcome();
    }
} else {
    showWelcome();
}

function showWelcome() {
    prompterText.innerHTML =
        '<div class="welcome">' +
            '<h1>👋 Welcome to Prompter</h1>' +
            '<p>Your free, browser-based teleprompter.</p>' +
            '<p class="welcome-hint">Start by typing your script below, or press <kbd>+ New Empty</kbd> to create a new content. Let\'s get your show on the road!</p>' +
        '</div>';
    prompterText.style.top = '';
}

// Klavye kısayolları — ana ve PiP pencerelerinin ikisinde de çalışır
function handleKeydown(e) {
    // Prompt modal açıkken hiçbir global kısayol tetiklenmesin
    if (!promptModalEl.hasAttribute('hidden')) return;    
    
    // Remote modal — Esc kapatır, açıkken diğer kısayollar devre dışı
    const remoteModalEl = document.getElementById('remoteModal');
    if (remoteModalEl && !remoteModalEl.hasAttribute('hidden')) {
        if (e.key === 'Escape') { e.preventDefault(); closeRemoteModal(); }
        return;
    }

    // Help modal — Esc her durumda kapatır
    if (e.key === 'Escape' && !helpModal.hasAttribute('hidden')) {
        e.preventDefault();
        closeHelp();
        return;
    }

    // Textarea veya başlık içinde yazarken kısayollar devre dışı
    if (document.activeElement === inputText || document.activeElement === titleInput) return;

    switch (e.key) {
        case ' ':
            e.preventDefault();
            togglePlay();
            break;
        case 'ArrowUp':
            e.preventDefault();
            setSpeed(parseFloat(speedInput.value) + 0.1);
            showStatus('Speed: ' + speedInput.value);
            break;
        case 'ArrowDown':
            e.preventDefault();
            setSpeed(parseFloat(speedInput.value) - 0.1);
            showStatus('Speed: ' + speedInput.value);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) cycleTemplate(-1); // önceki şablon
            else step(1);  // 1 satır geri
            break;
        case 'ArrowRight':
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) cycleTemplate(1); // sonraki şablon
            else step(-1); // 1 satır ileri
            break;
        case '+':
        case '=':
            e.preventDefault();
            setFont(parseInt(fontSize.value) + 4);
            showStatus('Font size: ' + fontSize.value + 'px');
            break;
        case '-':
        case '_':
            e.preventDefault();
            setFont(parseInt(fontSize.value) - 4);
            showStatus('Font size: ' + fontSize.value + 'px');
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            resetPosition();
            break;
        case 'f':
        case 'F':
            e.preventDefault();
            toggleFullscreen();
            break;
        case 'l':
        case 'L':
            e.preventDefault();
            loadText();
            break;
        case 'h':
        case 'H':
            e.preventDefault();
            toggleControls();
            break;
        case 'u':
        case 'U':
            e.preventDefault();
            undock();
            break;
        case 'c':
        case 'C':
        case 'p':
        case 'P':
            e.preventDefault();
            toggleTemplatesPanel();
            break;
        case '?':
            e.preventDefault();
            openHelp();
            break;
    }
}

// ---- Help modal ----
const helpModal = document.getElementById('helpModal');
const helpBtn = document.getElementById('helpBtn');
const helpCloseBtn = document.getElementById('helpCloseBtn');
function openHelp() { helpModal.removeAttribute('hidden'); }
function closeHelp() { helpModal.setAttribute('hidden', ''); }
helpBtn.addEventListener('click', openHelp);
helpCloseBtn.addEventListener('click', closeHelp);
helpModal.addEventListener('click', (e) => { if (e.target === helpModal) closeHelp(); });

// ---- Generic prompt modal ----
const promptModalEl = document.getElementById('promptModal');
const promptModalTitle = document.getElementById('promptModalTitle');
const promptModalLabel = document.getElementById('promptModalLabel');
const promptModalInput = document.getElementById('promptModalInput');
const promptModalOkBtn = document.getElementById('promptModalOkBtn');
const promptModalCancelBtn = document.getElementById('promptModalCancelBtn');
const promptModalCloseBtn = document.getElementById('promptModalCloseBtn');

let promptResolve = null;
function promptModal({ title = 'Prompt', label = '', value = '', okText = 'OK' } = {}) {
    return new Promise(resolve => {
        promptResolve = resolve;
        promptModalTitle.textContent = title;
        promptModalLabel.textContent = label;
        promptModalLabel.style.display = label ? 'block' : 'none';
        promptModalInput.value = value;
        promptModalOkBtn.textContent = okText;
        promptModalEl.removeAttribute('hidden');
        setTimeout(() => { promptModalInput.focus(); promptModalInput.select(); }, 0);
    });
}
function closePromptModal(result) {
    promptModalEl.setAttribute('hidden', '');
    if (promptResolve) { promptResolve(result); promptResolve = null; }
}
promptModalOkBtn.addEventListener('click', () => closePromptModal(promptModalInput.value));
promptModalCancelBtn.addEventListener('click', () => closePromptModal(null));
promptModalCloseBtn.addEventListener('click', () => closePromptModal(null));
promptModalEl.addEventListener('click', (e) => { if (e.target === promptModalEl) closePromptModal(null); });
promptModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); closePromptModal(promptModalInput.value); }
    else if (e.key === 'Escape') { e.preventDefault(); closePromptModal(null); }
});

document.addEventListener('keydown', handleKeydown);

// Fare tekerleği ile hız ayarı
function handleWheel(e) {
    if (document.activeElement === inputText || document.activeElement === titleInput) return;
    // Templates paneli, modallar ve remote uygulamasında normal kaydırmaya izin ver
    if (e.target.closest && e.target.closest('#templatesPanel, .modal-overlay, #remoteApp, #controls')) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setSpeed(parseFloat(speedInput.value) + delta);
    showStatus('Speed: ' + speedInput.value);
}

document.addEventListener('wheel', handleWheel, { passive: false });

// Başlangıç değerlerini ayarla — localStorage'taki tercihler varsa kullan
const savedPrefs = loadPrefs();
setSpeed(savedPrefs && savedPrefs.speed != null
    ? savedPrefs.speed
    : parseFloat(speedInput.value));
setFont(savedPrefs && savedPrefs.fontSize != null
    ? savedPrefs.fontSize
    : parseInt(fontSize.value));

// ========================================================================
// REMOTE CONTROL (PeerJS / WebRTC)
// Host (bu sayfa)   -> Peer açar, kısa bir kod üretir, komut bekler.
// Remote (telefon)  -> URL'de ?remote varsa kontrol paneli görünür,
//                      kod girilip bağlanıldığında komut gönderir.
// ========================================================================
const PEER_ID_PREFIX = 'prompter-';
const urlRemoteMatch = location.search.match(/(?:^|[?&])remote(?:=([^&]*))?/);
const urlIsRemote = !!urlRemoteMatch;
const urlRemoteCode = urlRemoteMatch && urlRemoteMatch[1] ? decodeURIComponent(urlRemoteMatch[1]) : '';

// Komut sözlüğü — remote'tan gelen mesajlar burada eşlenir
const remoteCommands = {
    play:           () => togglePlay(),
    back:           () => step(1),
    forward:        () => step(-1),
    reset:          () => resetPosition(),
    speedUp:        () => { setSpeed(parseFloat(speedInput.value) + 0.2); showStatus('Speed: ' + speedInput.value); },
    speedDown:      () => { setSpeed(parseFloat(speedInput.value) - 0.2); showStatus('Speed: ' + speedInput.value); },
    fontUp:         () => { setFont(parseInt(fontSize.value) + 4); showStatus('Font: ' + fontSize.value + 'px'); },
    fontDown:       () => { setFont(parseInt(fontSize.value) - 4); showStatus('Font: ' + fontSize.value + 'px'); },
    prevContent:    () => cycleTemplate(-1),
    nextContent:    () => cycleTemplate(1),
    fullscreen:     () => toggleFullscreen(),
    toggleControls: () => toggleControls(),
    load:           () => loadText(),
};

// ---- HOST (ana sayfa) ----
const remoteBtn = document.getElementById('remoteBtn');
const remoteModal = document.getElementById('remoteModal');
const remoteCloseBtn = document.getElementById('remoteCloseBtn');
const remoteDoneBtn = document.getElementById('remoteDoneBtn');
const remoteRegenBtn = document.getElementById('remoteRegenBtn');
const remoteOpenBtn = document.getElementById('remoteOpenBtn');
const remoteStopBtn = document.getElementById('remoteStopBtn');
const remoteDisconnectRemoteBtn = document.getElementById('remoteDisconnectRemoteBtn');
const remoteCodeEl = document.getElementById('remoteCode');
const remoteStatusEl = document.getElementById('remoteStatus');
const remoteUrlHint = document.getElementById('remoteUrlHint');

let hostPeer = null;
let hostConn = null;
let hostCode = null;

function randomCode(len = 6) {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // karışması zor harf/rakam
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
}

function setRemoteStatus(text, cls = '') {
    remoteStatusEl.textContent = text;
    remoteStatusEl.className = 'remote-status' + (cls ? ' ' + cls : '');
}

function renderRemoteCodeUI() {
    remoteCodeEl.textContent = hostCode ? hostCode.toUpperCase() : '------';
    const qrEl = document.getElementById('remoteQr');
    if (hostCode) {
        const url = location.origin + location.pathname + '?remote=' + hostCode;
        remoteUrlHint.innerHTML = 'Remote URL: <a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>';
        if (qrEl && typeof qrcode === 'function') {
            try {
                const qr = qrcode(0, 'M');
                qr.addData(url);
                qr.make();
                qrEl.innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });
                qrEl.title = 'Scan to open: ' + url;
            } catch (err) {
                qrEl.innerHTML = '';
            }
        }
    } else {
        remoteUrlHint.textContent = '';
        if (qrEl) qrEl.innerHTML = '';
    }
}

function startHostPeer() {
    stopHostPeer();
    hostCode = randomCode(6);
    setRemoteStatus('Initializing…');
    renderRemoteCodeUI();
    const peerId = PEER_ID_PREFIX + hostCode;
    hostPeer = new Peer(peerId);
    hostPeer.on('open', () => {
        setRemoteStatus('Waiting for remote to connect…');
        updateRemoteBtnState();
    });
    hostPeer.on('connection', (conn) => {
        if (hostConn) { try { hostConn.close(); } catch (e) {} }
        hostConn = conn;
        setRemoteStatus('✓ Remote connected', 'connected');
        updateRemoteBtnState();
        conn.on('open', () => {
            closeRemoteModal();
            showStatus('📱 Remote connected');
        });
        conn.on('data', (raw) => {
            try {
                const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
                if (msg && msg.cmd && remoteCommands[msg.cmd]) remoteCommands[msg.cmd]();
            } catch (e) {}
        });
        conn.on('close', () => {
            hostConn = null;
            if (hostPeer) setRemoteStatus('Waiting for remote to connect…');
            updateRemoteBtnState();
        });
    });
    hostPeer.on('error', (err) => {
        if (err && err.type === 'unavailable-id') {
            startHostPeer(); // kod çakıştıysa yeniden dene
            return;
        }
        setRemoteStatus('Connection error: ' + (err && err.type || err), 'error');
    });
}

function stopHostPeer() {
    try { if (hostConn) hostConn.close(); } catch (e) {}
    try { if (hostPeer) hostPeer.destroy(); } catch (e) {}
    hostConn = null;
    hostPeer = null;
    hostCode = null;
    if (remoteCodeEl) remoteCodeEl.textContent = '------';
    if (remoteUrlHint) remoteUrlHint.textContent = '';
    const qrEl = document.getElementById('remoteQr');
    if (qrEl) qrEl.innerHTML = '';
    setRemoteStatus('Hosting stopped.');
    updateRemoteBtnState();
}

function disconnectHostRemote() {
    if (hostConn) {
        try { hostConn.close(); } catch (e) {}
        hostConn = null;
        setRemoteStatus('Remote disconnected.');
        updateRemoteBtnState();
    }
}

function updateRemoteBtnState() {
    if (!remoteBtn) return;
    if (hostConn) {
        remoteBtn.textContent = '📱 Remote · connected';
        remoteBtn.classList.add('remote-active');
    } else if (hostPeer) {
        remoteBtn.textContent = '📱 Remote · hosting';
        remoteBtn.classList.add('remote-active');
    } else {
        remoteBtn.textContent = '📱 Remote';
        remoteBtn.classList.remove('remote-active');
    }
}

function openRemoteModal() {
    remoteModal.removeAttribute('hidden');
    if (!hostPeer) {
        startHostPeer();
    } else {
        // Var olan durumu yansıt
        renderRemoteCodeUI();
        setRemoteStatus(hostConn ? '✓ Remote connected' : 'Waiting for remote to connect…',
                        hostConn ? 'connected' : '');
    }
}

// Done / X / backdrop / Esc sadece modalı gizler — peer çalışmaya devam eder
function closeRemoteModal() {
    remoteModal.setAttribute('hidden', '');
}

if (!urlIsRemote) {
    remoteBtn.addEventListener('click', openRemoteModal);
    remoteCloseBtn.addEventListener('click', closeRemoteModal);
    remoteDoneBtn.addEventListener('click', closeRemoteModal);
    remoteRegenBtn.addEventListener('click', startHostPeer);
    remoteOpenBtn.addEventListener('click', () => {
        if (!hostCode) {
            startHostPeer();
        }
        const url = location.origin + location.pathname + '?remote=' + hostCode;
        window.open(url, '_blank', 'noopener');
    });
    remoteStopBtn.addEventListener('click', stopHostPeer);
    remoteDisconnectRemoteBtn.addEventListener('click', disconnectHostRemote);
    remoteModal.addEventListener('click', (e) => { if (e.target === remoteModal) closeRemoteModal(); });
}

// ---- REMOTE (telefon) ----
if (urlIsRemote) {
    document.body.classList.add('remote-mode');
    const remoteApp = document.getElementById('remoteApp');
    remoteApp.removeAttribute('hidden');

    const remotePairInput = document.getElementById('remotePairInput');
    const remotePairBtn = document.getElementById('remotePairBtn');
    const remotePairPanel = document.getElementById('remotePairPanel');
    const remoteControlPanel = document.getElementById('remoteControlPanel');
    const remoteAppStatus = document.getElementById('remoteAppStatus');
    const remoteDisconnectBtn = document.getElementById('remoteDisconnectBtn');

    let remotePeer = null;
    let remoteConn = null;

    function setRemoteAppStatus(text, cls = 'muted') {
        remoteAppStatus.textContent = text;
        remoteAppStatus.className = cls;
    }

    function pairWithHost() {
        const code = remotePairInput.value.trim().toLowerCase();
        if (!code) { remotePairInput.focus(); return; }
        setRemoteAppStatus('Connecting…');
        try { if (remotePeer) remotePeer.destroy(); } catch (e) {}
        remotePeer = new Peer();
        remotePeer.on('open', () => {
            const conn = remotePeer.connect(PEER_ID_PREFIX + code, { reliable: true });
            remoteConn = conn;
            conn.on('open', () => {
                setRemoteAppStatus('✓ Connected — code: ' + code.toUpperCase(), 'remote-status connected');
                remotePairPanel.setAttribute('hidden', '');
                remoteControlPanel.removeAttribute('hidden');
            });
            conn.on('close', () => {
                setRemoteAppStatus('Disconnected. Enter the code again.', 'remote-status error');
                remotePairPanel.removeAttribute('hidden');
                remoteControlPanel.setAttribute('hidden', '');
            });
            conn.on('error', (err) => {
                setRemoteAppStatus('Connection error: ' + (err && err.type || err), 'remote-status error');
            });
        });
        remotePeer.on('error', (err) => {
            const type = err && err.type || err;
            if (type === 'peer-unavailable') {
                setRemoteAppStatus('Code not found — check the prompter screen.', 'remote-status error');
            } else {
                setRemoteAppStatus('Error: ' + type, 'remote-status error');
            }
        });
    }

    function sendCmd(cmd) {
        if (!remoteConn || !remoteConn.open) return;
        try { remoteConn.send({ cmd }); } catch (e) {}
        // kısa haptic geribildirim
        if (navigator.vibrate) navigator.vibrate(15);
    }

    remotePairBtn.addEventListener('click', pairWithHost);
    remotePairInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); pairWithHost(); }
    });

    // ?remote=CODE ile gelindiyse otomatik bağlan
    if (urlRemoteCode) {
        remotePairInput.value = urlRemoteCode.toLowerCase();
        pairWithHost();
    }
    remoteControlPanel.querySelectorAll('.rc[data-cmd]').forEach(btn => {
        btn.addEventListener('click', () => sendCmd(btn.dataset.cmd));
    });
    remoteDisconnectBtn.addEventListener('click', () => {
        try { if (remoteConn) remoteConn.close(); } catch (e) {}
        try { if (remotePeer) remotePeer.destroy(); } catch (e) {}
        remotePeer = null; remoteConn = null;
        remotePairPanel.removeAttribute('hidden');
        remoteControlPanel.setAttribute('hidden', '');
        setRemoteAppStatus('Disconnected.', 'muted');
    });
}
updateStats();