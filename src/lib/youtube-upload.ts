import { readFileSync, writeFileSync, existsSync, createReadStream, statSync } from 'fs';
import path from 'path';
import { getProjectRoot } from './paths';

interface UploadMeta {
  title: string;
  description: string;
  tags: string[];
  categoryId?: string;
  privacyStatus?: 'public' | 'unlisted' | 'private';
}

/**
 * Upload a video to YouTube using OAuth2.
 * Requires client_secret.json and youtube_token.json in project root.
 */
export async function uploadToYouTube(
  videoPath: string,
  meta: UploadMeta,
  onProgress?: (pct: number) => void,
): Promise<string> {
  // Dynamic import to avoid breaking builds when googleapis not installed
  const { google } = await import('googleapis');

  const root = getProjectRoot();
  const secretPath = path.join(root, 'client_secret.json');
  const tokenPath = path.join(root, 'youtube_token.json');

  if (!existsSync(secretPath)) {
    throw new Error('client_secret.json not found in project root. Download from Google Cloud Console.');
  }
  if (!existsSync(tokenPath)) {
    throw new Error('youtube_token.json not found. Run initial OAuth flow first.');
  }

  // Load credentials
  const credentials = JSON.parse(readFileSync(secretPath, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed || credentials.web;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris?.[0] || 'http://localhost:8085',
  );

  // Load token
  const token = JSON.parse(readFileSync(tokenPath, 'utf-8'));
  oauth2Client.setCredentials(token);

  // Auto-refresh if expired
  if (token.expiry_date && token.expiry_date < Date.now()) {
    const { credentials: newToken } = await oauth2Client.refreshAccessToken();
    writeFileSync(tokenPath, JSON.stringify(newToken, null, 2));
    oauth2Client.setCredentials(newToken);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const fileSize = statSync(videoPath).size;

  const res = await youtube.videos.insert(
    {
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: meta.title,
          description: meta.description,
          tags: meta.tags,
          categoryId: meta.categoryId || '22', // People & Blogs
          defaultLanguage: 'ko',
          defaultAudioLanguage: 'ko',
        },
        status: {
          privacyStatus: meta.privacyStatus || 'private',
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: createReadStream(videoPath),
      },
    },
    {
      onUploadProgress: (evt: { bytesRead: number }) => {
        const pct = Math.round((evt.bytesRead / fileSize) * 100);
        onProgress?.(pct);
      },
    },
  );

  return res.data.id!;
}

/**
 * Build a YouTube Shorts description.
 */
export function buildDescription(
  title: string,
  tags: string[],
  channelUrl?: string,
): string {
  const hashtags = tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ');
  return `${title}

${channelUrl ? `🔗 ${channelUrl}\n\n` : ''}${hashtags}

Generated with ClipForge`;
}
