import path from 'path';
import { mkdirSync, existsSync } from 'fs';

/** Project root (clipforge/) */
export function getProjectRoot(): string {
  return path.resolve(process.cwd());
}

/** Workspace root: clipforge/workspace/ */
export function getWorkspaceRoot(): string {
  const ws = path.join(getProjectRoot(), 'workspace');
  mkdirSync(ws, { recursive: true });
  return ws;
}

/** Per-project workspace: workspace/{projectId}/ */
export function getProjectDir(projectId: string): string {
  const dir = path.join(getWorkspaceRoot(), projectId);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Standard paths within a project workspace */
export function getProjectPaths(projectId: string) {
  const root = getProjectDir(projectId);
  const clipsDir = path.join(root, 'clips');
  const renderedDir = path.join(root, 'rendered');
  mkdirSync(clipsDir, { recursive: true });
  mkdirSync(renderedDir, { recursive: true });

  return {
    root,
    source: path.join(root, 'source.mp4'),
    audio: path.join(root, 'source-audio.wav'),
    metadata: path.join(root, 'metadata.json'),
    transcript: path.join(root, 'transcript.json'),
    silence: path.join(root, 'silence.json'),
    analysis: path.join(root, 'analysis.json'),
    clipsDir,
    renderedDir,
  };
}

/** Fonts directory */
export function getFontsDir(): string {
  return path.join(getProjectRoot(), 'fonts');
}

/** Normalize path for ffmpeg (forward slashes) */
export function ffmpegPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Escape path for use inside ffmpeg filter_complex (colon escaping) */
export function ffmpegFilterPath(p: string): string {
  return ffmpegPath(p).replace(/:/g, '\\:');
}

/** Check if a file exists and is non-empty */
export function fileReady(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const { statSync } = require('fs');
    return statSync(filePath).size > 0;
  } catch {
    return false;
  }
}
