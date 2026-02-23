import { execFile, spawn } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/** Run ffmpeg command with args */
export async function runFfmpeg(args: string[]): Promise<string> {
  const { stdout, stderr } = await execFileAsync('ffmpeg', args, {
    maxBuffer: 100 * 1024 * 1024,
  });
  return stderr || stdout; // ffmpeg writes to stderr
}

/** Run ffprobe and return JSON */
export async function probe(filePath: string): Promise<FfprobeResult> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/** Get video duration in seconds */
export async function getDuration(filePath: string): Promise<number> {
  const info = await probe(filePath);
  return parseFloat(info.format.duration);
}

/** Extract audio from video as 16kHz mono WAV (optimal for Whisper) */
export async function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  await runFfmpeg([
    '-y',
    '-i', videoPath,
    '-vn',
    '-acodec', 'pcm_s16le',
    '-ar', '16000',
    '-ac', '1',
    audioPath,
  ]);
}

/** Cut a segment from video without re-encoding */
export async function cutSegment(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number,
): Promise<void> {
  const duration = endSec - startSec;
  await runFfmpeg([
    '-y',
    '-ss', startSec.toString(),
    '-i', inputPath,
    '-t', duration.toString(),
    '-c', 'copy',
    '-avoid_negative_ts', 'make_zero',
    outputPath,
  ]);
}

/** Run ffmpeg with progress parsing via spawn */
export function runFfmpegWithProgress(
  args: string[],
  totalDuration: number,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      // Parse "time=HH:MM:SS.ms"
      const match = data.toString().match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (match) {
        const [, h, m, s] = match.map(Number);
        const currentSec = h * 3600 + m * 60 + s;
        const pct = Math.min(100, Math.round((currentSec / totalDuration) * 100));
        onProgress(pct);
      }
    });

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
    });

    proc.on('error', reject);
  });
}

export interface FfprobeResult {
  format: {
    duration: string;
    size: string;
    bit_rate: string;
    [key: string]: unknown;
  };
  streams: Array<{
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
    duration?: string;
    [key: string]: unknown;
  }>;
}
