export {};

declare global {
  interface Window {
    vaultBridge: {
      saveCache: (data: string) => Promise<boolean>;
      loadCache: () => Promise<string | null>;
      openExternal: (url: string) => Promise<void>;
      openLogin: (opts: {
        id: string;
        url: string;
        username: string;
        password: string;
        totp: string | null;
        proxy: string | null;
      }) => Promise<void>;
      logoutAccount: (id: string) => Promise<void>;
      saveBackup: (opts: {
        filename: string;
        contents: string;
      }) => Promise<string | null>;
      updateStatus: () => Promise<boolean>;
      restartForUpdate: () => Promise<void>;
      onUpdateReady: (callback: () => void) => void;
    };
  }
}
