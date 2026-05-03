const google = require('googleapis');
import * as fs from 'fs';
import * as path from 'path';
import { YouTubeConfig } from '../config/types';
import { ensureDir, expandPath } from '../utils/file-utils';

let oauth2Client: any = null;

export function getOAuth2Client(config: YouTubeConfig): any {
  if (oauth2Client) return oauth2Client;

  const credsPath = expandPath(config.clientSecretFile);

  if (!fs.existsSync(credsPath)) {
    throw new Error(
      `OAuth client secret file not found at ${credsPath}.\n` +
      `Download it from Google Cloud Console (Credentials → OAuth 2.0 Client IDs → JSON).`
    );
  }

  const content = fs.readFileSync(credsPath, 'utf-8');
  const credentials = JSON.parse(content);

  const client = new google.auth.OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  );

  oauth2Client = client;
  return client;
}

export function loadStoredToken(config: YouTubeConfig): any {
  const tokenPath = expandPath(config.tokenFile);
  if (!fs.existsSync(tokenPath)) return null;

  try {
    const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    // google-auth-library expects token in a slightly different shape
    const client = getOAuth2Client(config);
    client.setCredentials(tokenData);
    return client;
  } catch (err) {
    console.error('Failed to load stored token:', err);
    return null;
  }
}

export function saveToken(config: YouTubeConfig, token: any): void {
  const tokenPath = expandPath(config.tokenFile);
  ensureDir(path.dirname(tokenPath));
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
}

export async function refreshAuth(client: any, config: YouTubeConfig): Promise<boolean> {
  try {
    const { credentials } = await client.refreshAccessToken();
    if (credentials) {
      saveToken(config, credentials);
      return true;
    }
  } catch (err) {
    console.error('Failed to refresh token:', err);
  }
  return false;
}
