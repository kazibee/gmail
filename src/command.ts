import { auth as googleAuth } from '@googleapis/gmail';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/drive.readonly',
];
const REDIRECT_PORT = 3848;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}`;

// Bundled OAuth app credentials — these belong to the tool, not the user.
// The user only needs to authorize via the browser to get a refresh token.
const CLIENT_ID = '258815534555-4uujer1icm690suaa8p46c64s4ric9h4.apps.googleusercontent.com';
const CLIENT_SECRET = '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';

export interface LoginResult {
  CLIENT_ID: string;
  CLIENT_SECRET: string;
  REFRESH_TOKEN: string;
}

/**
 * Runs the OAuth2 browser login flow to obtain a refresh token.
 *
 * 1. Starts a temporary local HTTP server on port 3848
 * 2. Opens the browser to Google's OAuth consent screen
 * 3. Receives the auth code via redirect
 * 4. Exchanges for refresh + access tokens
 * 5. Returns the credentials for storage via kazibee tool env
 */
export async function login(): Promise<LoginResult> {
  const oauth2 = new googleAuth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  const code = await waitForAuthCode(authUrl);
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh token received. This can happen if the app was previously authorized. ' +
        'Revoke access at https://myaccount.google.com/permissions and try again.',
    );
  }

  return {
    CLIENT_ID,
    CLIENT_SECRET,
    REFRESH_TOKEN: tokens.refresh_token,
  };
}

function waitForAuthCode(authUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', REDIRECT_URI);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization failed</h1><p>${error}</p>`);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful</h1><p>You can close this tab.</p>');
        server.close();
        resolve(code);
        return;
      }

      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h1>Missing authorization code</h1>');
    });

    server.listen(REDIRECT_PORT, () => {
      console.log(`\nOpen this URL in your browser to authorize:\n\n${authUrl}\n`);

      // Try to open browser automatically
      openBrowser(authUrl);
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to start callback server on port ${REDIRECT_PORT}: ${err.message}`));
    });
  });
}

function openBrowser(url: string): void {
  const { exec } = require('node:child_process') as typeof import('node:child_process');

  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'start'
    : 'xdg-open';

  exec(`${cmd} "${url}"`, () => {
    // Ignore errors — user can open the URL manually
  });
}
