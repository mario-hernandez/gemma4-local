const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Setup
  checkSetup: () => ipcRenderer.invoke('check-setup'),
  runSetup: () => ipcRenderer.invoke('run-setup'),
  onSetupProgress: (callback) => ipcRenderer.on('setup-progress', (_, msg) => callback(msg)),
  // App
  getConfig: () => ipcRenderer.invoke('get-config'),
  startServer: () => ipcRenderer.invoke('start-server'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  onServerStatus: (callback) => ipcRenderer.on('server-status', (_, data) => callback(data)),
  onServerLog: (callback) => ipcRenderer.on('server-log', (_, msg) => callback(msg)),
  // Conversations
  convSave: (conversation) => ipcRenderer.invoke('conv-save', conversation),
  convList: () => ipcRenderer.invoke('conv-list'),
  convLoad: (id) => ipcRenderer.invoke('conv-load', id),
  convDelete: (id) => ipcRenderer.invoke('conv-delete', id),
  convSearch: (query) => ipcRenderer.invoke('conv-search', query),
});
