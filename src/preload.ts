import { contextBridge, ipcRenderer } from 'electron';

// Read once, synchronously, so the renderer knows on first paint whether this
// PC is already connected.
const initialSettings = ipcRenderer.sendSync('settings:get-sync') as Record<
  string,
  unknown
>;

contextBridge.exposeInMainWorld('vaultBridge', {
  initialSettings,
  saveSettings: (patch: Record<string, unknown>): Promise<Record<string, unknown>> =>
    ipcRenderer.invoke('settings:set', patch),
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
  appVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  updateStatus: (): Promise<boolean> => ipcRenderer.invoke('update:status'),
  restartForUpdate: (): Promise<void> => ipcRenderer.invoke('update:restart'),
  onUpdateReady: (callback: () => void): void => {
    ipcRenderer.on('update:ready', callback);
  },
  driveStatus: (): Promise<{ configured: boolean; signedIn: boolean }> =>
    ipcRenderer.invoke('drive:status'),
  driveSetClientId: (clientId: string): Promise<void> =>
    ipcRenderer.invoke('drive:setClientId', clientId),
  driveSignIn: (): Promise<boolean> => ipcRenderer.invoke('drive:signIn'),
  driveSignOut: (): Promise<void> => ipcRenderer.invoke('drive:signOut'),
  driveList: (query: string): Promise<unknown[]> =>
    ipcRenderer.invoke('drive:list', query),
  driveThumbnail: (fileId: string, link: string): Promise<string | null> =>
    ipcRenderer.invoke('drive:thumbnail', fileId, link),
});
