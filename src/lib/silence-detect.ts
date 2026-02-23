import { execFile } from 'child_process';
import { promisify } from 'util';
import type { SilenceGap } from '@/types/project';

const execFileAsync = promisify(execFile);

/**
 * Detect silence gaps in audio using ffmpeg's silencedetect filter.
 * Returns sorted array of silence gaps.
 */
export async function detectSilence(
  audioPath: string,
  options: SilenceOptions = {},
): Promise<SilenceGap[]> {
  const {
    noiseThreshold = '-30dB',
    minDuration = 0.5,
  } = options;

  const { stderr } = await execFileAsync('ffmpeg', [
    '-i', audioPath,
    '-af', `silencedetect=noise=${noiseThreshold}:d=${minDuration}`,
    '-f', 'null',
    '-',
  ], { maxBuffer: 50 * 1024 * 1024 });

  return parseSilenceOutput(stderr);
}

/**
 * Parse ffmpeg silencedetect output.
 * Lines look like:
 *   [silencedetect @ ...] silence_start: 12.345
 *   [silencedetect @ ...] silence_end: 14.567 | silence_duration: 2.222
 */
function parseSilenceOutput(output: string): SilenceGap[] {
  const gaps: SilenceGap[] = [];
  const lines = output.split('\n');

  let currentStart: number | null = null;

  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    if (startMatch) {
      currentStart = parseFloat(startMatch[1]);
      continue;
    }

    const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (endMatch && currentStart !== null) {
      const end = parseFloat(endMatch[1]);
      const duration = parseFloat(endMatch[2]);
      gaps.push({ start: currentStart, end, duration });
      currentStart = null;
    }
  }

  return gaps.sort((a, b) => a.start - b.start);
}

/**
 * Remove silence gaps from a clip's time range.
 * Returns segments of non-silent audio to keep.
 */
export function getActiveSegments(
  startSec: number,
  endSec: number,
  silenceGaps: SilenceGap[],
  minGapToRemove: number = 0.8,
): Array<{ start: number; end: number }> {
  // Filter gaps within the clip range
  const relevantGaps = silenceGaps
    .filter(g => g.start >= startSec && g.end <= endSec && g.duration >= minGapToRemove);

  if (relevantGaps.length === 0) {
    return [{ start: startSec, end: endSec }];
  }

  const segments: Array<{ start: number; end: number }> = [];
  let cursor = startSec;

  for (const gap of relevantGaps) {
    if (gap.start > cursor) {
      segments.push({ start: cursor, end: gap.start });
    }
    cursor = gap.end;
  }

  if (cursor < endSec) {
    segments.push({ start: cursor, end: endSec });
  }

  return segments;
}

export interface SilenceOptions {
  noiseThreshold?: string;
  minDuration?: number;
}
