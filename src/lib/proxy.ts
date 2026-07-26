export interface ParsedProxy {
  rules: string;
  username?: string;
  password?: string;
}

/** "user:pass@host:port" | "host:port" | "http://host:port" → proxy config. */
export function parseProxy(raw: string): ParsedProxy | null {
  const value = raw.trim();
  if (!value) return null;
  const at = value.lastIndexOf('@');
  const creds = at === -1 ? '' : value.slice(0, at);
  const hostPart = (at === -1 ? value : value.slice(at + 1)).replace(/^\w+:\/\//, '');
  if (!/^[^\s:]+:\d+$/.test(hostPart)) return null;
  const [username, ...rest] = creds.replace(/^\w+:\/\//, '').split(':');
  return {
    rules: hostPart,
    username: creds ? username : undefined,
    password: creds ? rest.join(':') : undefined,
  };
}
