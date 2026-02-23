import { cutSegment, runFfmpeg } from './ffmpeg';
import { getActiveSegments } from './silence-detect';
import { getProjectPaths, ffmpegPath } from './paths';
import { writeFileSync } from 'fs';
import path from 'path';
import type { Clip, SilenceGap } from '@/types/project';

/**
 * Extract a single clip from the source video.
 * Optionally removes silence gaps.
 */
export async function extractClip(
  projectId: string,
  clip: Clip,
  silenceGaps: SilenceGap[],
  removeSilence: boolean = true,
): Promise<string> {
  const paths = getProjectPaths(projectId);
  const outputPath = path.join(paths.clipsDir, `${clip.id}.mp4`);

  if (!removeSilence || silenceGaps.length === 0) {
    // Simple cut without silence removal
    await cutSegment(paths.source, outputPath, clip.startSec, clip.endSec);
    return outputPath;
  }

  // Get non-silent segments within the clip range
  const segments = getActiveSegments(clip.startSec, clip.endSec, silenceGaps);

  if (segments.length <= 1) {
    // No silence to remove, just cut
    await cutSegment(paths.source, outputPath, clip.startSec, clip.endSec);
    return outputPath;
  }

  // Multiple segments: cut each then concat
  const tempFiles: string[] = [];
  const concatList: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const tempPath = path.join(paths.clipsDir, `${clip.id}_seg${i}.mp4`);
    await cutSegment(paths.source, tempPath, seg.start, seg.end);
    tempFiles.push(tempPath);
    concatList.push(`file '${ffmpegPath(tempPath)}'`);
  }

  // Write concat list file
  const listPath = path.join(paths.clipsDir, `${clip.id}_concat.txt`);
  writeFileSync(listPath, concatList.join('\n'));

  // Concat segments
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ]);

  // Clean up temp files
  const { unlinkSync } = require('fs');
  for (const f of [...tempFiles, listPath]) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }

  return outputPath;
}

/**
 * Extract all clips from a project.
 * Returns updated clip objects with sourcePath set.
 */
export async function extractAllClips(
  projectId: string,
  clips: Clip[],
  silenceGaps: SilenceGap[],
  onProgress?: (current: number, total: number, clipTitle: string) => void,
): Promise<Clip[]> {
  const results: Clip[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(i + 1, clips.length, clip.title);

    const sourcePath = await extractClip(projectId, clip, silenceGaps);
    results.push({ ...clip, sourcePath, status: 'extracted' });
  }

  return results;
}
