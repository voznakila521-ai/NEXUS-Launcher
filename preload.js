const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexus', {
  profile: () => ipcRenderer.invoke('get-profile'),
  saveProfile: (p) => ipcRenderer.invoke('save-profile', p),
  list: () => ipcRenderer.invoke('list-builds'),
  create: (p) => ipcRenderer.invoke('create-build', p),
  detail: (id) => ipcRenderer.invoke('build-detail', id),
  deleteBuild: (id) => ipcRenderer.invoke('delete-build', id),
  setRam: (id, v) => ipcRenderer.invoke('set-build-ram', id, v),
  toggleMod: (id, f) => ipcRenderer.invoke('toggle-mod', id, f),
  removeMod: (id, f) => ipcRenderer.invoke('remove-mod', id, f),
  refreshLogs: (id) => ipcRenderer.invoke('refresh-logs', id),
  openFolder: (id) => ipcRenderer.invoke('open-build-folder', id),
  openMods: (id) => ipcRenderer.invoke('open-mods-folder', id),
  install: (id) => ipcRenderer.invoke('install-build', id),
  quickCheck: (id) => ipcRenderer.invoke('quick-check-build', id),
  play: (id) => ipcRenderer.invoke('play-build', id),
  onLog: (cb) => ipcRenderer.on('build-log', (_e, id, msg) => cb(id, msg)),
  onInstall: (cb) => ipcRenderer.on('install-status', (_e, id, status) => cb(id, status)),
  onProgress: (cb) => ipcRenderer.on('install-progress', (_e, id, progress) => cb(id, progress)),
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (cb) => ipcRenderer.on('update-status', (_e, status) => cb(status))
});
