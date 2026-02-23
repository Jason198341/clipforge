import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Transcription, TranscriptSegment, TranscriptWord } from '@/types/project';

const execFileAsync = promisify(execFile);

/**
 * Transcribe audio using whisper.cpp via nodejs-whisper or whisper CLI.
 * Falls back to Python whisper if whisper.cpp not available.
 *
 * Outputs word-level timestamps for accurate subtitle sync.
 */
export async function transcribe(
  audioPath: string,
  outputDir: string,
  options: TranscribeOptions = {},
): Promise<Transcription> {
  const {
    model = 'base',
    language = 'auto',
  } = options;

  const outputBase = path.join(outputDir, 'transcript');

  // Try whisper.cpp first (faster), then Python whisper
  try {
    return await runWhisperCpp(audioPath, outputBase, model, language);
  } catch {
    console.log('whisper.cpp not found, trying Python whisper...');
    return await runPythonWhisper(audioPath, outputBase, model, language);
  }
}

/** Run whisper.cpp (via main binary) */
async function runWhisperCpp(
  audioPath: string,
  outputBase: string,
  model: string,
  language: string,
): Promise<Transcription> {
  // whisper.cpp outputs JSON with word-level timestamps
  const modelPath = resolveWhisperModel(model);
  const args = [
    '-m', modelPath,
    '-f', audioPath,
    '--output-json-full',
    '-of', outputBase,
    '-ml', '1',  // max segment length: 1 sentence
  ];

  if (language !== 'auto') {
    args.push('-l', language);
  }

  await execFileAsync('whisper', args, {
    maxBuffer: 100 * 1024 * 1024,
    timeout: 600000, // 10 min
  });

  return parseWhisperCppOutput(outputBase + '.json');
}

/** Run Python whisper (openai-whisper) */
async function runPythonWhisper(
  audioPath: string,
  outputBase: string,
  model: string,
  language: string,
): Promise<Transcription> {
  const outputDir = path.dirname(outputBase);
  const args = [
    '-m', 'whisper',
    audioPath,
    '--model', model,
    '--output_format', 'json',
    '--word_timestamps', 'True',
    '--output_dir', outputDir,
  ];

  if (language !== 'auto') {
    args.push('--language', language);
  }

  await execFileAsync('python', args, {
    maxBuffer: 100 * 1024 * 1024,
    timeout: 1200000, // 20 min
  });

  // Python whisper outputs {audioFileName}.json
  const audioName = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, audioName + '.json');
  return parsePythonWhisperOutput(jsonPath);
}

/** Parse whisper.cpp JSON output */
function parseWhisperCppOutput(jsonPath: string): Transcription {
  if (!existsSync(jsonPath)) {
    throw new Error(`Whisper output not found: ${jsonPath}`);
  }

  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const result = raw.transcription || raw.result || raw;
  const lang = raw.result?.language || 'en';

  // whisper.cpp format: array of { timestamps: {from, to}, text, ... }
  // or { segments: [...] } depending on version
  const rawSegments = Array.isArray(result) ? result : (result.segments || []);

  const segments: TranscriptSegment[] = rawSegments.map((seg: WhisperCppSegment) => {
    const start = parseTimestamp(seg.timestamps?.from || seg.t0 || seg.start);
    const end = parseTimestamp(seg.timestamps?.to || seg.t1 || seg.end);
    const text = (seg.text || '').trim();

    const words: TranscriptWord[] = (seg.tokens || seg.words || [])
      .filter((t: WhisperCppToken) => t.text?.trim())
      .map((t: WhisperCppToken) => ({
        start: parseTimestamp(t.timestamps?.from || t.t0 || t.start),
        end: parseTimestamp(t.timestamps?.to || t.t1 || t.end),
        word: t.text.trim(),
        probability: t.p,
      }));

    return { start, end, text, words };
  });

  return {
    language: lang,
    segments,
    fullText: segments.map(s => s.text).join(' '),
  };
}

/** Parse Python whisper JSON output */
function parsePythonWhisperOutput(jsonPath: string): Transcription {
  if (!existsSync(jsonPath)) {
    throw new Error(`Whisper output not found: ${jsonPath}`);
  }

  const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  const segments: TranscriptSegment[] = (raw.segments || []).map((seg: PythonWhisperSegment) => {
    const words: TranscriptWord[] = (seg.words || []).map((w: PythonWhisperWord) => ({
      start: w.start,
      end: w.end,
      word: w.word.trim(),
      probability: w.probability,
    }));

    return {
      start: seg.start,
      end: seg.end,
      text: seg.text.trim(),
      words,
    };
  });

  return {
    language: raw.language || 'en',
    segments,
    fullText: raw.text || segments.map(s => s.text).join(' '),
  };
}

/** Parse timestamp string "HH:MM:SS.mmm" to seconds */
function parseTimestamp(ts: string | number | undefined): number {
  if (typeof ts === 'number') return ts;
  if (!ts) return 0;

  // "00:01:23.456" format
  const parts = ts.split(':');
  if (parts.length === 3) {
    const [h, m, s] = parts.map(parseFloat);
    return h * 3600 + m * 60 + s;
  }
  return parseFloat(ts) || 0;
}

/** Resolve whisper model path */
function resolveWhisperModel(model: string): string {
  // Common paths for whisper.cpp models
  const candidates = [
    `ggml-${model}.bin`,
    path.join(process.env.HOME || '', '.cache', 'whisper', `ggml-${model}.bin`),
    path.join(process.env.LOCALAPPDATA || '', 'whisper', `ggml-${model}.bin`),
  ];

  for (const c of candidates) {
    if (existsSync(c)) return c;
  }

  // Return the name and let whisper handle it
  return `ggml-${model}.bin`;
}

// Types for raw whisper outputs
interface WhisperCppSegment {
  timestamps?: { from: string; to: string };
  t0?: number;
  t1?: number;
  start?: number;
  end?: number;
  text: string;
  tokens?: WhisperCppToken[];
  words?: WhisperCppToken[];
}

interface WhisperCppToken {
  timestamps?: { from: string; to: string };
  t0?: number;
  t1?: number;
  start?: number;
  end?: number;
  text: string;
  p?: number;
}

interface PythonWhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: PythonWhisperWord[];
}

interface PythonWhisperWord {
  start: number;
  end: number;
  word: string;
  probability?: number;
}

export interface TranscribeOptions {
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
}
