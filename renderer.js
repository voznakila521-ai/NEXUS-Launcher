const content = document.getElementById('content');
const title = document.getElementById('pageTitle');
const modal = document.getElementById('modal');

let builds = [];
let selected = null;
let tab = 'overview';
let page = 'builds';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

async function load() {
  try {
    builds = await window.nexus.list();
  } catch (e) {
    builds = [];
    console.error(e);
  }
  renderBuilds();
}

function card(b) {
  return `
    <article class="instance-card">
      <div class="cover ${esc(b.loader.toLowerCase())}">
        <span class="pill">${esc(b.loader)}</span>
        <div class="cover-title">${esc(b.name)}</div>
        <span class="version">Minecraft ${esc(b.version)} · ${b.ram} GB RAM</span>
      </div>
      <div class="card-bottom">
        <button class="green" data-action="play" data-id="${esc(b.id)}">▶ Play</button>
        <button class="outline" data-action="detail" data-id="${esc(b.id)}">Details ↗</button>
        <span class="ramtag">${b.installed ? 'Installed' : 'Not installed'}</span>
      </div>
    </article>`;
}

function renderBuilds() {
  selected = null;
  page = 'builds';
  title.textContent = 'Сборки';

  content.innerHTML = `
    <div class="welcome">
      <div>
        <div class="eyebrow">YOUR CLIENT BUILDS</div>
        <h2>Сборки Minecraft</h2>
        <p>Каждая сборка — отдельная папка, настройки, моды и логи. Java и файлы игры лаунчер ставит сам.</p>
      </div>
      <button class="outline" id="welcomeCreate">＋ Создать сборку</button>
    </div>
    <div class="toolbar">
      <h3>Мои сборки <span class="count">${builds.length}</span></h3>
      <input class="search" id="search" placeholder="Поиск…">
    </div>
    <div class="cards" id="cards">
      ${
        builds.map(card).join('') ||
        '<div class="empty">Сборок пока нет. Создай первую сборку.</div>'
      }
    </div>`;

  const search = document.getElementById('search');
  if (search) {
    search.oninput = (e) => {
      const q = e.target.value.toLowerCase();
      const filtered = builds.filter((b) =>
        (b.name + ' ' + b.loader + ' ' + b.version).toLowerCase().includes(q)
      );
      document.getElementById('cards').innerHTML =
        filtered.map(card).join('') || '<div class="empty">Не найдено</div>';
      bindCardButtons();
    };
  }

  const welcomeCreate = document.getElementById('welcomeCreate');
  if (welcomeCreate) welcomeCreate.onclick = openModal;

  bindCardButtons();
}

function bindCardButtons() {
  content.querySelectorAll('[data-action="play"]').forEach((btn) => {
    btn.onclick = () => playBuild(btn.dataset.id);
  });
  content.querySelectorAll('[data-action="detail"]').forEach((btn) => {
    btn.onclick = () => openDetail(btn.dataset.id);
  });
}

async function openDetail(id) {
  selected = id;
  tab = 'overview';
  page = 'detail';
  await renderDetail();
}

async function renderDetail() {
  const d = await window.nexus.detail(selected);
  if (!d) {
    renderBuilds();
    return;
  }

  title.textContent = d.name;

  content.innerHTML = `
    <button class="back" id="backBtn">← Назад к сборкам</button>
    <div class="detail-hero ${esc(d.loader.toLowerCase())}">
      <span class="pill">${esc(d.loader)}</span>
      <h2>${esc(d.name)}</h2>
      <p>Minecraft ${esc(d.version)} · ${d.ram} GB RAM · ${
    d.installed ? 'Установлена' : 'Не установлена'
  }</p>
      <button class="green" id="smartActionBtn">⬇ Быстро скачать / Проверить</button>
      <button class="green" id="playBtn">▶ Запустить</button>
      <button class="outline" id="folderBtn">Папка сборки</button>
    </div>
    <div class="install-progress-pane" id="installProgressPane">
      <div class="progress-head"><b id="progressStage">Ожидание установки</b><span id="progressPercent">0%</span></div>
      <div class="progress-track"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
      <div class="progress-meta"><span id="progressBytes">0 B / 0 B</span><span id="progressSpeed">0 MB/s</span><span id="progressEta">Осталось: рассчитывается</span><span id="progressElapsed">Время: 00:00</span></div>
      <div class="progress-file" id="progressFile">Действие: ожидание</div>
    </div>
    <div class="tabs">
      <button class="tab ${tab === 'overview' ? 'selected' : ''}" data-tab="overview">Обзор</button>
      <button class="tab ${tab === 'mods' ? 'selected' : ''}" data-tab="mods">Моды <span>${d.mods.length}</span></button>
      <button class="tab ${tab === 'logs' ? 'selected' : ''}" data-tab="logs">Логи</button>
      <button class="tab ${tab === 'settings' ? 'selected' : ''}" data-tab="settings">Настройки</button>
    </div>
    <div id="detailBody">${detailBody(d)}</div>`;

  document.getElementById('backBtn').onclick = () => load();
  document.getElementById('smartActionBtn').onclick = () => smartCheckDownload(d.id, d.installed);
  document.getElementById('playBtn').onclick = () => playBuild(d.id);
  document.getElementById('folderBtn').onclick = () =>
    window.nexus.openFolder(d.id);

  content.querySelectorAll('.tab').forEach((t) => {
    t.onclick = () => setTab(t.dataset.tab);
  });

  bindDetailActions(d);
}

function detailBody(d) {
  if (tab === 'mods') {
    return `
      <div class="pane">
        <div class="toolbar">
          <h3>Моды этой сборки (${d.mods.length})</h3>
          <button class="outline" id="openModsBtn">Открыть mods</button>
        </div>
        ${
          d.mods
            .map(
              (m) => `
          <div class="modrow">
            <div class="modicon">◇</div>
            <div class="modname">${esc(m.name)}<small>${
                m.enabled ? 'Включен' : 'Отключен'
              }</small></div>
            <button class="outline" data-mod-toggle="${esc(m.name)}">${
                m.enabled ? 'Отключить' : 'Включить'
              }</button>
            <button class="danger" data-mod-remove="${esc(m.name)}">Удалить</button>
          </div>`
            )
            .join('') ||
          '<div class="empty">Добавь jar-моды в папку mods этой сборки.</div>'
        }
      </div>`;
  }

  if (tab === 'logs') {
    return `
      <div class="pane">
        <div class="toolbar">
          <h3>Логи: ${esc(d.name)}</h3>
          <button class="outline" id="refreshLogBtn">↻ Обновить</button>
        </div>
        <p class="hint">Здесь только журнал выбранной сборки.</p>
        <pre class="logview" id="logview">${esc(d.logs)}</pre>
      </div>`;
  }

  if (tab === 'settings') {
    return `
      <div class="pane">
        <h3>Настройки сборки</h3>
        <label class="ram-label">RAM <b id="ramLabel">${d.ram} GB</b></label>
        <input class="ram-slider" id="ramSlider" type="range" min="2" max="16" value="${d.ram}">
        <div class="ramends"><span>2 GB</span><span>16 GB</span></div>
        <button class="green" id="saveRamBtn">Сохранить память</button>
        <button class="outline" id="openFolderSettings">Открыть папку сборки</button>
        <button class="danger" id="deleteBtn">Удалить сборку</button>
      </div>`;
  }

  // overview
  return `
    <div class="overview">
      <div class="pane">
        <h3>Информация</h3>
        <div class="stats">
          <div><small>Ядро</small><b>${esc(d.loader)}</b></div>
          <div><small>Версия</small><b>${esc(d.version)}</b></div>
          <div><small>RAM</small><b>${d.ram} GB</b></div>
          <div><small>Моды</small><b>${d.mods.length}</b></div>
        </div>
        <p class="hint">Java, игровые файлы и необходимые библиотеки загружаются лаунчером при нажатии «Установить / проверить файлы». Игроку ничего дополнительно скачивать не нужно.</p>
      </div>
      <div class="pane">
        <h3>Действия</h3>
        <button class="outline" data-goto="mods">Моды →</button>
        <button class="outline" data-goto="logs">Логи этой сборки →</button>
        <button class="outline" id="openFolderOverview">Открыть папку</button>
      </div>
    </div>`;
}

function scrollLogToBottom() {
  const el = document.getElementById('logview');
  if (el) el.scrollTop = el.scrollHeight;
}
function fmtProgressBytes(value) {
  const n = Number(value) || 0;
  if (n < 1024) return `${n.toFixed(0)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtEta(seconds) {
  if (seconds == null || !Number.isFinite(Number(seconds))) return 'Осталось: рассчитывается';
  const n = Math.max(0, Math.round(Number(seconds)));
  return n < 60 ? `Осталось: ${n}s` : `Осталось: ${Math.floor(n / 60)}m ${n % 60}s`;
}
let installStartedAt = null;
let elapsedTimer = null;
function fmtElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `Время: ${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function beginProgressClock() {
  installStartedAt = Date.now();
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = setInterval(() => {
    const el = document.getElementById('progressElapsed');
    if (el && installStartedAt) el.textContent = fmtElapsed(Date.now() - installStartedAt);
  }, 1000);
}
function stopProgressClock() {
  if (elapsedTimer) clearInterval(elapsedTimer);
  elapsedTimer = null;
}
function applyInstallProgress(data) {
  if (!data) return;
  const pct = Math.min(100, Math.max(0, Number(data.percent) || 0));
  const fill = document.getElementById('progressFill');
  const percent = document.getElementById('progressPercent');
  const stage = document.getElementById('progressStage');
  const bytes = document.getElementById('progressBytes');
  const speed = document.getElementById('progressSpeed');
  const eta = document.getElementById('progressEta');
  const file = document.getElementById('progressFile');
  const elapsed = document.getElementById('progressElapsed');
  if (fill) fill.style.width = `${pct}%`;
  if (percent) percent.textContent = `${pct.toFixed(1)}%`;
  if (stage) stage.textContent = data.stage || 'Установка';
  if (bytes) bytes.textContent = `${fmtProgressBytes(data.bytes)} / ${fmtProgressBytes(data.totalBytes)}`;
  if (speed) speed.textContent = `${(Number(data.speed || 0) / 1024 / 1024).toFixed(2)} MB/s`;
  if (eta) eta.textContent = fmtEta(data.etaSeconds);
  if (file) file.textContent = data.file ? `Действие: ${data.stage || 'Обработка'} · ${data.file}` : `Действие: ${data.stage || 'Обработка файлов'}`;
  if (elapsed && installStartedAt) elapsed.textContent = fmtElapsed(Date.now() - installStartedAt);
}

function bindDetailActions(d) {
  // mods
  content.querySelectorAll('[data-mod-toggle]').forEach((btn) => {
    btn.onclick = async () => {
      await window.nexus.toggleMod(d.id, btn.dataset.modToggle);
      renderDetail();
    };
  });
  content.querySelectorAll('[data-mod-remove]').forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('Удалить мод ' + btn.dataset.modRemove + '?')) return;
      await window.nexus.removeMod(d.id, btn.dataset.modRemove);
      renderDetail();
    };
  });
  const openModsBtn = document.getElementById('openModsBtn');
  if (openModsBtn) openModsBtn.onclick = () => window.nexus.openMods(d.id);

  // logs
  const refreshLogBtn = document.getElementById('refreshLogBtn');
  if (refreshLogBtn) {
    refreshLogBtn.onclick = async () => {
      const l = await window.nexus.refreshLogs(d.id);
      const el = document.getElementById('logview');
      if (el) { el.textContent = l; scrollLogToBottom(); }
    };
  }

  // settings
  const ramSlider = document.getElementById('ramSlider');
  if (ramSlider) {
    ramSlider.oninput = () => {
      document.getElementById('ramLabel').textContent =
        ramSlider.value + ' GB';
    };
  }
  const saveRamBtn = document.getElementById('saveRamBtn');
  if (saveRamBtn) {
    saveRamBtn.onclick = async () => {
      await window.nexus.setRam(d.id, document.getElementById('ramSlider').value);
      renderDetail();
    };
  }
  const openFolderSettings = document.getElementById('openFolderSettings');
  if (openFolderSettings)
    openFolderSettings.onclick = () => window.nexus.openFolder(d.id);

  const deleteBtn = document.getElementById('deleteBtn');
  if (deleteBtn) {
    deleteBtn.onclick = async () => {
      if (!confirm('Удалить сборку и её папку полностью?')) return;
      await window.nexus.deleteBuild(d.id);
      await load();
    };
  }

  // overview shortcuts
  content.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.onclick = () => setTab(btn.dataset.goto);
  });
  const openFolderOverview = document.getElementById('openFolderOverview');
  if (openFolderOverview)
    openFolderOverview.onclick = () => window.nexus.openFolder(d.id);
}

async function setTab(t) {
  tab = t;
  await renderDetail();
}

async function smartCheckDownload(id, installed) {
  beginProgressClock();
  const btn = document.getElementById('smartActionBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⚡ Проверка…'; }
  applyInstallProgress({ percent: 0, bytes: 0, totalBytes: 0, speed: 0, etaSeconds: null, stage: 'Проверка: запуск', file: '' });
  try {
    const result = await window.nexus.quickCheck(id);
    if (!result.ok) {
      alert(result.message + (result.detail ? `\n\n${result.detail}` : ''));
      return;
    }
    const needsDownload = !installed || Number(result.actionCount) > 0;
    if (!needsDownload) {
      alert(`Быстрая проверка завершена\nMinecraft: ${result.version}\nЯдро: ${result.loader}\nМодов: ${result.modCount}\n\nФайлы сборки в порядке, скачивание не требуется.`);
      return;
    }
    if (btn) btn.textContent = '⬇ Подготовка загрузки…';
    const status = await window.nexus.install(id);
    alert(`Проверка завершена.\n${status.message}${status.detail ? `\n\n${status.detail}` : ''}`);
  } catch (e) {
    alert('Ошибка проверки/установки: ' + e.message);
  } finally {
    if (page === 'detail') await renderDetail();
  }
}

async function installBuild(id) {
  const btn = document.getElementById('installBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Установка…';
  }
  try {
    const status = await window.nexus.install(id);
    alert(status.message + (status.detail ? '\n\n' + status.detail : ''));
  } catch (e) {
    alert('Ошибка: ' + e.message);
  }
  await renderDetail();
}

async function playBuild(id) {
  const btn = document.getElementById('playBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Запуск…';
  }
  try {
    const status = await window.nexus.play(id);
    if (!status.ok) {
      alert(status.message + (status.detail ? '\n\n' + status.detail : ''));
    }
  } catch (e) {
    alert('Ошибка запуска: ' + e.message);
  }
  if (page === 'detail') await renderDetail();
  else await load();
}

function openModal() {
  modal.classList.add('show');
  document.getElementById('buildName').focus();
}

function closeModal() {
  modal.classList.remove('show');
}

async function renderProfile() {
  page = 'profile';
  selected = null;
  title.textContent = 'Профиль';

  const p = await window.nexus.profile();
  content.innerHTML = `
    <div class="pane profile-pane">
      <h3>Оффлайн-профиль</h3>
      <p class="hint">Ник используется при запуске в оффлайн-режиме. Для серверов с online-mode нужна лицензированная авторизация Microsoft.</p>
      <label>
        Ник игрока
        <input id="offlineNick" value="${esc(p.offlineName)}" maxlength="16" placeholder="Player">
      </label>
      <p class="hint">3–16 символов: латиница, цифры и нижнее подчёркивание.</p>
      <button class="green" id="saveProfile">Сохранить ник</button>
      <div id="profileMsg" class="hint"></div>
    </div>`;

  document.getElementById('saveProfile').onclick = async () => {
    const r = await window.nexus.saveProfile({
      offlineName: document.getElementById('offlineNick').value
    });
    const msg = document.getElementById('profileMsg');
    msg.textContent = r.ok ? 'Ник сохранён.' : r.error;
    if (r.ok) {
      document.getElementById('sidebarNick').textContent =
        r.profile.offlineName;
    }
  };
}

/* ---------- Event wiring ---------- */
document.getElementById('newBtn').onclick = openModal;
document.getElementById('closeModal').onclick = closeModal;

document.getElementById('ram').oninput = (e) => {
  document.getElementById('ramValue').textContent = e.target.value + ' GB';
};

document.getElementById('createBtn').onclick = async () => {
  const name = document.getElementById('buildName').value.trim();
  if (!name) {
    document.getElementById('buildName').focus();
    return;
  }
  const r = await window.nexus.create({
    name,
    version: document.getElementById('version').value.trim() || '1.21.4',
    loader: document.getElementById('loader').value,
    ram: document.getElementById('ram').value
  });
  if (!r.ok) {
    alert(r.error);
    return;
  }
  document.getElementById('buildName').value = '';
  closeModal();
  await load();
};

// close modal on backdrop click
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

document.querySelectorAll('.nav').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.nav').forEach((n) => n.classList.remove('active'));
    b.classList.add('active');
    if (b.dataset.page === 'profile') renderProfile();
    else load();
  };
});

// Live logs are appended and scrolled to the newest line automatically.
window.nexus.onLog((id, msg) => {
  if (page === 'detail' && selected === id && tab === 'logs') {
    const el = document.getElementById('logview');
    if (el) {
      el.textContent += `\n[${new Date().toLocaleString()}] ${msg}`;
      scrollLogToBottom();
    }
  }
});
window.nexus.onProgress((id, progress) => {
  if (page === 'detail' && selected === id) applyInstallProgress(progress);
});
window.nexus.onInstall((id, status) => {
  stopProgressClock();
  if (page === 'detail' && selected === id) {
    const btn = document.getElementById('installBtn');
    if (btn) btn.textContent = status;
  }
});

// init
window.nexus.profile().then((p) => {
  document.getElementById('sidebarNick').textContent =
    p.offlineName || 'Player';
});
load();

// ---------- Launcher self-update UI ----------
(() => {
  const notice = document.getElementById('updateNotice');
  const heading = document.getElementById('updateTitle');
  const message = document.getElementById('updateText');
  const details = document.getElementById('updateDetails');
  const bar = document.getElementById('updateBar');
  const approve = document.getElementById('updateApprove');
  const later = document.getElementById('updateLater');
  let updateReady = false;
  function show() { notice?.classList.remove('hidden'); }
  function hide() { notice?.classList.add('hidden'); }
  later?.addEventListener('click', hide);
  approve?.addEventListener('click', async () => {
    if (updateReady) {
      await window.nexus.installUpdate();
      return;
    }
    approve.disabled = true;
    heading.textContent = 'Скачивание обновления';
    message.textContent = 'Загружаем новую версию NEXUS…';
    try {
      const result = await window.nexus.downloadUpdate();
      if (!result?.ok) { message.textContent = result?.error || 'Не удалось начать загрузку.'; approve.disabled = false; }
    } catch (err) { message.textContent = err.message; approve.disabled = false; }
  });
  window.nexus.onUpdateStatus((status) => {
    if (!status) return;
    if (status.state === 'available') {
      updateReady = false; approve.disabled = false; approve.textContent = 'Скачать';
      heading.textContent = 'Доступно обновление NEXUS';
      message.textContent = `Новая версия ${status.version}. Скачать и установить?`;
      details.textContent = 'Установка выполняется только после вашего подтверждения.';
      show();
    } else if (status.state === 'downloading') {
      const pct = Math.max(0, Math.min(100, Number(status.percent) || 0));
      bar.style.width = `${pct}%`;
      message.textContent = `Скачивание обновления — ${pct.toFixed(1)}%`;
      details.textContent = `${(status.transferred / 1048576).toFixed(1)} / ${(status.total / 1048576).toFixed(1)} MB · ${(status.bytesPerSecond / 1048576).toFixed(1)} MB/s`;
      approve.textContent = 'Скачивание…'; approve.disabled = true; show();
    } else if (status.state === 'downloaded') {
      updateReady = true; bar.style.width = '100%'; approve.disabled = false; approve.textContent = 'Установить и перезапустить';
      heading.textContent = 'Обновление скачано'; message.textContent = `Версия ${status.version} готова. Установить сейчас?`;
      details.textContent = 'Старая версия будет заменена установщиком после закрытия лаунчера.'; show();
    } else if (status.state === 'none') {
      // Keep quiet during routine checks.
    } else if (status.state === 'error') {
      details.textContent = status.message || 'Ошибка проверки обновления';
    }
  });
  // Manual check button is available via window.nexus.checkUpdates for future settings UI.
})();
