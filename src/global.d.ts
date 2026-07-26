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
      }) => Promise<void>;
    };
  }
}
