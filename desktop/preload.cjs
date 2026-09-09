const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("aliquotDesktop", {
  saveConfig: (config) => ipcRenderer.invoke("aliquot-save-config", config),
});
