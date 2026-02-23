import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import type { VideoMetadata } from '@/types/project';

/**
 * Download a YouTube video using yt-dlp.
 * Saves to workspace/{projectId}/source.mp4
 */
export function downloadVideo(
  url: string,
  outputPath: string,
  onProgress?: (pct: number, message: string) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best',
      '--merge-output-format', 'mp4',
      '--no-playlist',
      '--write-info-json',
      '--write-thumbnail',
      '--convert-thumbnails', 'jpg',
      '-o', outputPath,
      '--progress',
      '--newline',
      url,
    ];

    const proc = spawn('yt-dlp', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      // Parse progress: "[download]  45.2% of ~123.45MiB"
      const match = line.match(/\[download\]\s+([\d.]+)%/);
      if (match && onProgress) {
        onProgress(parseFloat(match[1]), line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`yt-dlp exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', (err) => {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        reject(new Error('yt-dlp not found. Install it: pip install yt-dlp'));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Extract metadata from the .info.json file written by yt-dlp
 */
export function readMetadata(projectDir: string): VideoMetadata {
  // yt-dlp writes source.mp4.info.json or source.info.json
  const candidates = [
    path.join(projectDir, 'source.mp4.info.json'),
    path.join(projectDir, 'source.info.json'),
  ];

  let infoPath = '';
  for (const c of candidates) {
    if (existsSync(c)) { infoPath = c; break; }
  }

  // Also check for any .info.json in the dir
  if (!infoPath) {
    const { readdirSync } = require('fs');
    const files: string[] = readdirSync(projectDir);
    const infoFile = files.find((f: string) => f.endsWith('.info.json'));
    if (infoFile) infoPath = path.join(projectDir, infoFile);
  }

  if (!infoPath) {
    return {
      title: 'Unknown',
      channelName: 'Unknown',
      duration: 0,
      thumbnailUrl: '',
      description: '',
    };
  }

  const raw = JSON.parse(readFileSync(infoPath, 'utf-8'));
  return {
    title: raw.title || raw.fulltitle || 'Untitled',
    channelName: raw.channel || raw.uploader || 'Unknown',
    duration: raw.duration || 0,
    thumbnailUrl: raw.thumbnail || '',
    description: (raw.description || '').slice(0, 500),
  };
}

/** Validate that a URL looks like a YouTube video */
export function isValidYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
    return validHosts.includes(u.hostname);
  } catch {
    return false;
  }
}
