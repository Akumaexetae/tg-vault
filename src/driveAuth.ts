import { BrowserWindow, app } from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

/**
 * Google OAuth for a desktop app: PKCE with a loopback redirect.
 *
 * There is no client *secret* here on purpose — a secret shipped inside a
 * binary isn't secret, and Google's "Desktop app" client type is designed for
 * exactly this. PKCE is what actually protects the exchange.
 */

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface DriveTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

const tokenPath = () => path.join(app.getPath('userData'), 'drive-tokens.json');

export function loadTokens(): DriveTokens | null {
  try {
    return JSON.parse(fs.readFileSync(tokenPath(), 'utf-8')) as DriveTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: DriveTokens): void {
  fs.writeFileSync(tokenPath(), JSON.stringify(tokens), 'utf-8');
}

export function clearTokens(): void {
  try {
    fs.unlinkSync(tokenPath());
  } catch {
    /* already gone */
  }
}

const base64url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

/** Listens on a random loopback port for Google's redirect. */
function awaitRedirect(): Promise<{ port: number; code: Promise<string> }> {
  return new Promise((resolve, reject) => {
    let settle: (code: string) => void;
    let fail: (e: Error) => void;
    const code = new Promise<string>((res, rej) => {
      settle = res;
      fail = rej;
    });

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      const received = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<html><body style="font-family:system-ui;text-align:center;padding-top:60px">
         <h2>${received ? 'Connected' : 'Sign-in cancelled'}</h2>
         <p>You can close this tab and return to T&amp;G Vault.</p>
         </body></html>`,
      );
      server.close();
      if (received) settle(received);
      else fail(new Error(error ?? 'Sign-in was cancelled.'));
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'string' || !address) {
        reject(new Error('Could not open a local port for sign-in.'));
        return;
      }
      resolve({ port: address.port, code });
    });

    // Don't leave a listener open if the user walks away.
    setTimeout(() => {
      server.close();
      fail(new Error('Sign-in timed out.'));
    }, 5 * 60 * 1000);
  });
}

export async function signIn(clientId: string): Promise<DriveTokens> {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const { port, code } = await awaitRedirect();
  const redirectUri = `http://127.0.0.1:${port}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });

  const win = new BrowserWindow({
    width: 520,
    height: 680,
    title: 'Sign in to Google',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  win.loadURL(`${AUTH_URL}?${params.toString()}`);

  try {
    const authCode = await code;
    win.close();

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        code: authCode,
        code_verifier: verifier,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });
    const body = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error_description?: string;
      error?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(body.error_description ?? body.error ?? 'Google refused the sign-in.');
    }
    const tokens: DriveTokens = {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
    };
    saveTokens(tokens);
    return tokens;
  } finally {
    if (!win.isDestroyed()) win.close();
  }
}

export async function refresh(clientId: string): Promise<DriveTokens | null> {
  const current = loadTokens();
  if (!current?.refresh_token) return null;

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      refresh_token: current.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!response.ok || !body.access_token) return null;

  const tokens: DriveTokens = {
    access_token: body.access_token,
    // Google doesn't resend the refresh token, so carry the existing one over.
    refresh_token: current.refresh_token,
    expires_at: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  saveTokens(tokens);
  return tokens;
}
