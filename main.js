const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let win;
const root = path.join(app.getPath('userData'), 'NEXUS');
const buildsDir = path.join(root, 'builds');
const dataFile = path.join(root, 'launcher.json');
let kitPromise = null;
const installProgressByBuild = new Map();

function ensure() {
  fs.mkdirSync(buildsDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(
      dataFile,
      JSON.stringify({ builds: [], profile: { offlineName: 'Player' } }, null, 2)
    );
  }
}

function readData() {
  ensure();
  try {
    const d = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    d.builds = d.builds || [];
    d.profile = d.profile || { offlineName: 'Player' };
    return d;
  } catch {
    return { builds: [], profile: { offlineName: 'Player' } };
  }
}

function saveData(d) {
  ensure();
  fs.writeFileSync(dataFile, JSON.stringify(d, null, 2));
}

function safeId(id) {
  return String(id).replace(/[^a-z0-9_-]/gi, '');
}

function buildPath(id) {
  return path.join(buildsDir, safeId(id));
}

function logPath(id) {
  return path.join(buildPath(id), 'logs', 'nexus.log');
}

function appendLog(id, msg) {
  fs.mkdirSync(path.dirname(logPath(id)), { recursive: true });
  const line = `[${new Date().toLocaleString()}] ${msg}\n`;
  fs.appendFileSync(logPath(id), line);
  if (win && !win.isDestroyed()) {
    win.webContents.send('build-log', id, msg);
  }
}

function sendInstallProgress(id, payload) {
  installProgressByBuild.set(id, payload);
  if (win && !win.isDestroyed()) win.webContents.send('install-progress', id, payload);
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}


function readLog(id) {
  if (!fs.existsSync(logPath(id))) return 'Пока логов нет.';
  return fs.readFileSync(logPath(id), 'utf8');
}

function scanMods(id) {
  const p = path.join(buildPath(id), 'mods');
  fs.mkdirSync(p, { recursive: true });
  return fs
    .readdirSync(p)
    .filter(
      (f) =>
        f.toLowerCase().endsWith('.jar') ||
        f.toLowerCase().endsWith('.jar.disabled')
    )
    .map((f) => ({
      name: f,
      enabled: f.toLowerCase().endsWith('.jar'),
      path: path.join(p, f)
    }));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#101310',
    title: 'NEXUS Launcher',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('index.html');
}

function setupAutoUpdater() {
  if (!app.isPackaged) return; // Updates are only enabled in packaged builds.
  autoUpdater.autoDownload = false; // Ask the user before downloading.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on('checking-for-update', () => win?.webContents.send('update-status', { state: 'checking' }));
  autoUpdater.on('update-available', (info) => win?.webContents.send('update-status', { state: 'available', version: info.version }));
  autoUpdater.on('update-not-available', (info) => win?.webContents.send('update-status', { state: 'none', version: info.version }));
  autoUpdater.on('download-progress', (progress) => win?.webContents.send('update-status', { state: 'downloading', percent: progress.percent, transferred: progress.transferred, total: progress.total, bytesPerSecond: progress.bytesPerSecond }));
  autoUpdater.on('update-downloaded', (info) => win?.webContents.send('update-status', { state: 'downloaded', version: info.version }));
  autoUpdater.on('error', (error) => win?.webContents.send('update-status', { state: 'error', message: error.message }));
  // Check after the window is ready; never silently download/install.
  setTimeout(() => autoUpdater.checkForUpdates().catch((error) => {
    win?.webContents.send('update-status', { state: 'error', message: error.message });
  }), 2500);
}


app.whenReady().then(() => {
  ensure();
  createWindow();
  setupAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- Launcher updates ---------- */
ipcMain.handle('check-updates', async () => {
  if (!app.isPackaged) return { ok: false, error: 'Проверка обновлений доступна в установленной версии лаунчера.' };
  try { const result = await autoUpdater.checkForUpdates(); return { ok: true, version: result?.updateInfo?.version || null }; }
  catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('download-update', async () => {
  if (!app.isPackaged) return { ok: false, error: 'Скачивание обновлений доступно в установленной версии.' };
  try { await autoUpdater.downloadUpdate(); return { ok: true }; }
  catch (error) { return { ok: false, error: error.message }; }
});
ipcMain.handle('install-update', () => {
  if (!app.isPackaged) return { ok: false, error: 'Установите лаунчер, чтобы использовать обновления.' };
  // electron-updater/NSIS performs replacement after the current app exits.
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

/* ---------- Profile ---------- */
ipcMain.handle('get-profile', () => readData().profile);

ipcMain.handle('save-profile', (_e, profile) => {
  const d = readData();
  const nick = String(profile?.offlineName || 'Player').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(nick)) {
    return {
      ok: false,
      error: 'Ник: 3–16 символов, латинские буквы, цифры и _'
    };
  }
  d.profile.offlineName = nick;
  saveData(d);
  return { ok: true, profile: d.profile };
});

/* ---------- Builds ---------- */
ipcMain.handle('list-builds', () => readData().builds);

ipcMain.handle('create-build', (_e, payload) => {
  const d = readData();
  const name = String(payload.name || 'Новая сборка').trim().slice(0, 48);
  if (!name) return { ok: false, error: 'Укажи название сборки' };

  const id =
    'b' + Date.now().toString(36) + crypto.randomBytes(2).toString('hex');
  const item = {
    id,
    name,
    version: String(payload.version || '1.21.4'),
    loader: String(payload.loader || 'Vanilla'),
    ram: Math.max(2, Math.min(16, Number(payload.ram) || 4)),
    created: Date.now(),
    installed: false
  };

  const p = buildPath(id);
  for (const folder of [
    'mods',
    'logs',
    'config',
    'resourcepacks',
    'saves'
  ]) {
    fs.mkdirSync(path.join(p, folder), { recursive: true });
  }

  d.builds.push(item);
  saveData(d);
  appendLog(
    id,
    `Сборка создана: ${name} | Minecraft ${item.version} | ${item.loader}`
  );
  return { ok: true, item };
});

ipcMain.handle('build-detail', (_e, id) => {
  const b = readData().builds.find((x) => x.id === id);
  if (!b) return null;
  return {
    ...b,
    mods: scanMods(id),
    logs: readLog(id),
    progress: installProgressByBuild.get(id) || null
  };
});

ipcMain.handle('delete-build', (_e, id) => {
  const d = readData();
  const b = d.builds.find((x) => x.id === id);
  if (!b) return false;
  d.builds = d.builds.filter((x) => x.id !== id);
  saveData(d);
  try {
    fs.rmSync(buildPath(id), { recursive: true, force: true });
  } catch (_) {}
  return true;
});

ipcMain.handle('set-build-ram', (_e, id, ram) => {
  const d = readData();
  const b = d.builds.find((x) => x.id === id);
  if (!b) return null;
  b.ram = Math.max(2, Math.min(16, Number(ram) || 4));
  saveData(d);
  appendLog(id, `RAM изменена: ${b.ram} GB`);
  return b.ram;
});

ipcMain.handle('toggle-mod', (_e, id, filename) => {
  const p = path.join(buildPath(id), 'mods');
  const from = path.join(p, filename);
  const to = path.join(
    p,
    filename.toLowerCase().endsWith('.disabled')
      ? filename.slice(0, -9)
      : filename + '.disabled'
  );
  if (fs.existsSync(from)) {
    fs.renameSync(from, to);
    appendLog(id, `Mod toggle: ${filename}`);
  }
  return scanMods(id);
});

ipcMain.handle('remove-mod', (_e, id, filename) => {
  const p = path.join(buildPath(id), 'mods', filename);
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    appendLog(id, `Mod removed: ${filename}`);
  }
  return scanMods(id);
});

ipcMain.handle('open-build-folder', (_e, id) => {
  fs.mkdirSync(buildPath(id), { recursive: true });
  return shell.openPath(buildPath(id));
});

ipcMain.handle('open-mods-folder', (_e, id) => {
  const p = path.join(buildPath(id), 'mods');
  fs.mkdirSync(p, { recursive: true });
  return shell.openPath(p);
});

ipcMain.handle('refresh-logs', (_e, id) => readLog(id));
ipcMain.handle('quick-check-build', async (_e, id) => {
  const b = readData().builds.find((x) => x.id === id);
  if (!b) return { ok: false, message: 'Сборка не найдена' };
  const issues = [];
  const checkProgress = (percent, stage, file = '') => sendInstallProgress(id, { percent, bytes: 0, totalBytes: 0, speed: 0, etaSeconds: null, stage: `Проверка: ${stage}`, file });
  checkProgress(0, 'Запуск');
  appendLog(id, `Быстрая проверка: Minecraft ${b.version}, ядро ${b.loader}`);
  try {
    checkProgress(12, 'Загрузка Minecraft Kit');
    const kit = await getKit();
    const { MinecraftKit, Loaders, asMinecraftVersionId } = kit;
    const mk = new MinecraftKit();
    checkProgress(28, 'Проверка конфигурации Target');
    const target = await mk.targets.resolve({
      id,
      directory: buildPath(id),
      minecraft: { version: asMinecraftVersionId(b.version) },
      loader: { type: loaderType(Loaders, b.loader) }
    });
    appendLog(id, `Проверка Target: версия ${b.version}, loader ${b.loader}`);
    checkProgress(45, 'Сканирование Minecraft и ядра');
    const plan = await mk.install.plan(target);
    const actions = Array.isArray(plan.actions) ? plan.actions : [];
    const actionCount = Number(plan.totalActions) || actions.length;
    const bytes = Number(plan.totalBytes) || 0;
    checkProgress(62, `План файлов: ${actionCount} действий`);
    appendLog(id, `План проверен: действий к выполнению ${actionCount}, объём ${formatBytes(bytes)}`);
    if (actionCount > 0) issues.push(`Нужно загрузить/обновить ${actionCount} файлов или действий (${formatBytes(bytes)})`);
    else appendLog(id, 'Minecraft и ядро: план не требует загрузок.');

    checkProgress(78, 'Проверка модов');
    const mods = scanMods(id);
    const enabled = mods.filter(m => m.enabled);
    appendLog(id, `Моды: ${enabled.length} включено, ${mods.length - enabled.length} отключено`);
    const loaderKey = String(b.loader).toLowerCase();
    const modWarnings = enabled.filter(m => {
      const n = m.name.toLowerCase();
      if (loaderKey === 'fabric') return n.includes('forge') || n.includes('neoforge');
      if (loaderKey === 'forge') return n.includes('fabric') || n.includes('quilt');
      if (loaderKey === 'neoforge') return n.includes('fabric') || n.includes('quilt');
      if (loaderKey === 'quilt') return n.includes('forge') || n.includes('neoforge');
      return true;
    });
    if (loaderKey === 'vanilla' && enabled.length) {
      issues.push(`Vanilla не загружает моды через loader: найдено ${enabled.length} .jar в mods`);
      appendLog(id, 'ПРЕДУПРЕЖДЕНИЕ: выбрано Vanilla, но папка mods содержит включённые JAR-моды.');
    } else if (modWarnings.length && loaderKey !== 'vanilla') {
      appendLog(id, `Предупреждение: возможная несовместимость модов с ${b.loader} (по именам файлов).`);
      issues.push(`Есть ${modWarnings.length} модов с возможными маркерами другого загрузчика. Это предварительная проверка по имени, не подтверждение несовместимости.`);
    }
    checkProgress(92, 'Проверка Java Runtime');
    const javaDir = path.join(buildPath(id), 'runtime');
    const javaExists = fs.existsSync(javaDir);
    appendLog(id, javaExists ? 'Java runtime: папка runtime найдена.' : 'Java runtime: локальная папка runtime не найдена; kit может использовать/установить runtime отдельно.');
    const resultText = issues.length ? issues.join('\n') : 'Критичных проблем быстрой проверки не обнаружено.';
    appendLog(id, `Итог быстрой проверки: ${resultText}`);
    checkProgress(100, 'Проверка завершена');
    return { ok: true, message: resultText, actionCount, bytes, loader: b.loader, version: b.version, modCount: enabled.length };
  } catch (e) {
    checkProgress(100, 'Ошибка');
    appendLog(id, `Быстрая проверка завершилась ошибкой: ${e?.stack || e}`);
    return { ok: false, message: 'Проверка не удалась', detail: String(e?.message || e) };
  }
});

/* ---------- Minecraft Kit helpers ---------- */
async function getKit() {
  if (!kitPromise) {
    kitPromise = import('@loontail/minecraft-kit');
  }
  return kitPromise;
}

function loaderType(Loaders, loaderName) {
  const t = String(loaderName || 'Vanilla').toLowerCase();
  const map = {
    vanilla: Loaders.VANILLA,
    fabric: Loaders.FABRIC,
    forge: Loaders.FORGE,
    neoforge: Loaders.NEOFORGE || Loaders.FORGE,
    quilt: Loaders.QUILT || Loaders.FABRIC
  };
  return map[t] || Loaders.FABRIC;
}

/* ---------- Install (Minecraft + loader + Java runtime) ---------- */
ipcMain.handle('install-build', async (_e, id) => {
  const b = readData().builds.find((x) => x.id === id);
  if (!b) return { ok: false, message: 'Сборка не найдена' };

  appendLog(
    id,
    'Запуск подготовки: Minecraft + ядро + Java runtime…'
  );
  if (win && !win.isDestroyed()) {
    win.webContents.send('install-status', id, 'Установка / проверка файлов…');
  }

  try {
    const kit = await getKit();
    const { MinecraftKit, Loaders, asMinecraftVersionId } = kit;
    const mk = new MinecraftKit();

    const target = await mk.targets.resolve({
      id,
      directory: buildPath(id),
      minecraft: {
        version: asMinecraftVersionId(b.version)
      },
      loader: { type: loaderType(Loaders, b.loader) }
    });

    const plan = await mk.install.plan(target);
    const totalBytes = Number(plan.totalBytes) || 0;
    const totalActions = Number(plan.totalActions) || (plan.actions?.length || 0);
    appendLog(id, `План установки: ${totalActions} действий, ${formatBytes(totalBytes)} файлов`);

    // Real progress events from minecraft-kit, aggregated into a throttled snapshot.
    const tracker = typeof kit.createInstallProgressTracker === 'function'
      ? kit.createInstallProgressTracker(plan, { throttleMs: 50 })
      : null;
    const startedAt = Date.now();
    let currentFile = '';
    let stageName = 'Подготовка';
    let lastSnapshotBytes = 0;
    let lastSnapshotAt = startedAt;
    let speedBytesPerSec = 0;
    let lastPercentLogged = -1;
    const fallbackFileBytes = new Map();

    const sendSnapshot = (snapshot = {}) => {
      const overallBytes = Math.max(0, Number(snapshot.overallBytesDownloaded ?? snapshot.bytesDownloaded ?? 0));
      const overallTotal = Math.max(0, Number(snapshot.overallTotalBytes ?? snapshot.totalBytes ?? totalBytes));
      const pct = overallTotal > 0
        ? Math.min(100, Math.max(0, Number(snapshot.overallPercent ?? (overallBytes / overallTotal * 100))))
        : Math.min(99, Math.max(0, Number(snapshot.stagePercent ?? 0)));
      const now = Date.now();
      const dt = Math.max(0.25, (now - lastSnapshotAt) / 1000);
      const delta = Math.max(0, overallBytes - lastSnapshotBytes);
      if (delta > 0) {
        const instant = delta / dt;
        speedBytesPerSec = speedBytesPerSec ? speedBytesPerSec * 0.65 + instant * 0.35 : instant;
      }
      lastSnapshotBytes = overallBytes;
      lastSnapshotAt = now;
      const etaSeconds = speedBytesPerSec > 0 && overallTotal > overallBytes
        ? Math.ceil((overallTotal - overallBytes) / speedBytesPerSec)
        : null;
      sendInstallProgress(id, {
        percent: pct,
        bytes: overallBytes,
        totalBytes: overallTotal,
        speed: speedBytesPerSec,
        etaSeconds,
        stage: stageName,
        file: currentFile
      });
      const rounded = Math.floor(pct);
      if (rounded >= lastPercentLogged + 5 || rounded === 100) {
        lastPercentLogged = rounded;
        appendLog(id, `Прогресс установки: ${formatBytes(overallBytes)} / ${formatBytes(overallTotal)} (${rounded}%)${speedBytesPerSec ? ` · ${formatBytes(speedBytesPerSec)}/s` : ''}${etaSeconds != null ? ` · осталось ${etaSeconds}s` : ''}`);
      }
    };

    const onEvent = (event) => {
      const filePath = event?.file?.path || event?.file?.name || event?.file?.url || '';
      if (filePath && (event?.type === 'download:started' || event?.type === 'download:progress')) currentFile = String(filePath);
      if (tracker) tracker.onEvent(event);
      switch (event?.type) {
        case 'install:phase-changed':
          stageName = String(event.phase || 'Установка');
          appendLog(id, `Этап: ${stageName}`);
          break;
        case 'download:started':
          currentFile = String(filePath);
          appendLog(id, `Скачивание: ${currentFile || 'файл'}${event.expectedSize ? ` (${formatBytes(event.expectedSize)})` : ''}`);
          break;
        case 'download:progress':
          if (filePath) currentFile = String(filePath);
          break;
        case 'download:completed':
          appendLog(id, `Загружено: ${filePath || 'файл'} (${formatBytes(event.bytes || 0)})`);
          break;
        case 'download:skipped':
          appendLog(id, `Пропуск, уже существует: ${filePath || 'файл'}`);
          break;
        case 'download:failed':
          appendLog(id, `Ошибка загрузки ${filePath || 'файла'}: ${event.error?.message || event.error}${event.willRetry ? ' · повтор' : ''}`);
          break;
        case 'archive:extracted':
          appendLog(id, `Распаковано: ${event.archive || filePath} · ${event.fileCount || 0} файлов`);
          break;
        case 'forge:processor-started':
          appendLog(id, `Запуск Forge processor ${event.processor?.index ?? ''}`);
          break;
        case 'forge:processor-completed':
          appendLog(id, `Forge processor завершён (код ${event.exitCode})`);
          break;
      }
      if (event?.type === 'download:progress') {
        const key = String(filePath || currentFile || 'current-download');
        fallbackFileBytes.set(key, Math.max(0, Number(event.bytesDownloaded) || 0));
        const cumulative = Array.from(fallbackFileBytes.values()).reduce((sum, value) => sum + value, 0);
        // Keep the UI responsive even if the tracker throttles its aggregate snapshots.
        if (!tracker) sendSnapshot({ overallBytesDownloaded: cumulative, overallTotalBytes: totalBytes, overallPercent: totalBytes ? cumulative / totalBytes * 100 : 0, stagePercent: 0 });
        else sendInstallProgress(id, { percent: totalBytes ? Math.min(99, cumulative / totalBytes * 100) : 0, bytes: cumulative, totalBytes, speed: speedBytesPerSec, etaSeconds: null, stage: stageName, file: currentFile });
      } else if (!tracker && (event?.type === 'download:completed' || event?.type === 'download:skipped')) {
        const key = String(filePath || currentFile || 'current-download');
        if (event?.type === 'download:completed' && Number(event.bytes) > 0) fallbackFileBytes.set(key, Number(event.bytes));
        const cumulative = Array.from(fallbackFileBytes.values()).reduce((sum, value) => sum + value, 0);
        sendSnapshot({ overallBytesDownloaded: cumulative, overallTotalBytes: totalBytes, overallPercent: totalBytes ? cumulative / totalBytes * 100 : 0, stagePercent: 0 });
      }
    };

    if (tracker) tracker.subscribe(sendSnapshot);
    sendInstallProgress(id, { percent: 0, bytes: 0, totalBytes, speed: 0, etaSeconds: null, stage: 'Планирование', file: '' });
    await mk.install.run(plan, { onEvent });
    if (tracker) tracker.finish();
    sendInstallProgress(id, { percent: 100, bytes: totalBytes, totalBytes, speed: speedBytesPerSec, etaSeconds: 0, stage: 'Готово', file: '' });

    appendLog(
      id,
      'Файлы установлены. Java runtime управляется библиотекой при подготовке цели.'
    );

    const d = readData();
    const item = d.builds.find((x) => x.id === id);
    if (item) {
      item.installed = true;
      saveData(d);
    }

    if (win && !win.isDestroyed()) {
      win.webContents.send('install-status', id, 'Установка завершена');
    }
    return {
      ok: true,
      message: 'Подготовка завершена. Можно запускать сборку.'
    };
  } catch (e) {
    const msg = e?.stack || e?.message || String(e);
    appendLog(id, 'Установка не завершилась: ' + msg);
    if (win && !win.isDestroyed()) {
      win.webContents.send('install-status', id, 'Ошибка установки');
      const previous = installProgressByBuild.get(id) || {};
      sendInstallProgress(id, { ...previous, stage: 'Ошибка', etaSeconds: null });
    }
    return {
      ok: false,
      message: 'Не удалось установить сборку. Смотри Logs этой сборки.',
      detail: String(e?.message || e)
    };
  }
});

/* ---------- Play ---------- */
ipcMain.handle('play-build', async (_e, id) => {
  const b = readData().builds.find((x) => x.id === id);
  if (!b) return { ok: false, message: 'Сборка не найдена' };

  const nick = readData().profile.offlineName || 'Player';
  appendLog(id, `Запуск: ${nick} (offline) · ${b.ram} GB RAM`);

  try {
    const kit = await getKit();
    const { MinecraftKit, AuthModes, Loaders, asMinecraftVersionId } = kit;
    const mk = new MinecraftKit();

    const target = await mk.targets.resolve({
      id,
      directory: buildPath(id),
      minecraft: {
        version: asMinecraftVersionId(b.version)
      },
      loader: { type: loaderType(Loaders, b.loader) }
    });

    const composition = await mk.launch.compose(target, {
      auth: {
        mode: AuthModes.OFFLINE,
        username: nick
      },
      memory: {
        max: `${b.ram}G`
      }
    });

    const session = mk.launch.run(composition);
    appendLog(id, 'Процесс Minecraft запущен.');

    if (session && session.exited) {
      session.exited
        .then((code) =>
          appendLog(id, `Minecraft завершился (код ${code}).`)
        )
        .catch((err) =>
          appendLog(id, `Ошибка завершения: ${err.message}`)
        );
    }

    return { ok: true, message: 'Minecraft запущен.' };
  } catch (e) {
    appendLog(id, 'Ошибка запуска: ' + (e?.stack || e));
    return {
      ok: false,
      message:
        'Запуск не удался. Сначала нажми «Установить / проверить файлы» и посмотри Logs.',
      detail: String(e?.message || e)
    };
  }
});
