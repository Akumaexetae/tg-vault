import {
  siOnlyfans,
  siInstagram,
  siTiktok,
  siThreads,
  siX,
  siReddit,
  siSnapchat,
  siTelegram,
  siDiscord,
  siGmail,
} from 'simple-icons';

export type ServiceIconDef =
  | { type: 'brand'; path: string; hex: string }
  | { type: 'favicon' };

export interface ServiceDef {
  key: string;
  name: string;
  url: string;
  icon: ServiceIconDef;
}

const brand = (icon: { path: string; hex: string }): ServiceIconDef => ({
  type: 'brand',
  path: icon.path,
  hex: icon.hex,
});

/** Bundled service catalog — order = display order in pickers/sidebar. */
export const SERVICES: ServiceDef[] = [
  { key: 'onlyfans', name: 'OnlyFans', url: 'https://onlyfans.com', icon: brand(siOnlyfans) },
  { key: 'getmysocials', name: 'Getmysocials', url: 'https://getmysocial.com/dashboard/links', icon: { type: 'favicon' } },
  { key: 'onlychat', name: 'Onlychat', url: 'https://app.only-chat.ai/?tab=overview', icon: { type: 'favicon' } },
  { key: 'smspool', name: 'SMSPool', url: 'https://smspool.net', icon: { type: 'favicon' } },
  { key: 'instagram', name: 'Instagram', url: 'https://instagram.com', icon: brand(siInstagram) },
  { key: 'tiktok', name: 'TikTok', url: 'https://tiktok.com', icon: brand(siTiktok) },
  { key: 'threads', name: 'Threads', url: 'https://threads.net', icon: brand(siThreads) },
  { key: 'x', name: 'X / Twitter', url: 'https://x.com', icon: brand(siX) },
  { key: 'reddit', name: 'Reddit', url: 'https://reddit.com', icon: brand(siReddit) },
  { key: 'snapchat', name: 'Snapchat', url: 'https://snapchat.com', icon: brand(siSnapchat) },
  { key: 'telegram', name: 'Telegram', url: 'https://telegram.org', icon: brand(siTelegram) },
  { key: 'discord', name: 'Discord', url: 'https://discord.com', icon: brand(siDiscord) },
  { key: 'gmail', name: 'Gmail', url: 'https://mail.google.com', icon: brand(siGmail) },
  { key: 'geelark', name: 'GeeLark', url: 'https://geelark.com', icon: { type: 'favicon' } },
  { key: 'qonto', name: 'Qonto', url: 'https://qonto.com', icon: { type: 'favicon' } },
];

export const serviceDef = (key: string): ServiceDef | undefined =>
  SERVICES.find((s) => s.key === key);

/** Google favicon service URL for a site, or null if the URL is unparseable. */
export const faviconUrl = (url: string): string | null => {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
};
