export {};

declare global {
  interface Window {
    vaultBridge: {
      initialSettings: Record<string, unknown>;
      saveSettings: (
        patch: Record<string, unknown>,
      ) => Promise<Record<string, unknown>>;
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
      appVersion: () => Promise<string>;
      updateStatus: () => Promise<boolean>;
      restartForUpdate: () => Promise<void>;
      onUpdateReady: (callback: () => void) => void;
      driveStatus: () => Promise<{ configured: boolean; signedIn: boolean }>;
      driveSetClientId: (clientId: string) => Promise<void>;
      driveSignIn: () => Promise<boolean>;
      driveSignOut: () => Promise<void>;
      driveList: (query: string) => Promise<unknown[]>;
    };
  }
}
