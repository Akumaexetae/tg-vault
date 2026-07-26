import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vaultBridge', {
  saveCache: (data: string): Promise<boolean> =>
    ipcRenderer.invoke('cache:save', data),
  loadCache: (): Promise<string | null> => ipcRenderer.invoke('cache:load'),
  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('open-external', url),
  openLogin: (opts: {
    id: string;
    url: string;
    username: string;
    password: string;
    totp: string | null;
    proxy: string | null;
  }): Promise<void> => ipcRenderer.invoke('login:open', opts),
  logoutAccount: (id: string): Promise<void> =>
    ipcRenderer.invoke('login:logout', id),
  saveBackup: (opts: {
    filename: string;
    contents: string;
  }): Promise<string | null> => ipcRenderer.invoke('backup:save', opts),
});
