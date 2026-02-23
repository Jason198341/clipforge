import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import type { Transcription, TranscriptSegment, TranscriptWord } from '@/types/project';

/**
 * Transcribe audio using Python openai-whisper.
 * Uses spawn for real-time progress parsing (stderr percentage lines).
 */
export async function transcribe(
  audioPath: string,
  outputDir: string,
  options: TranscribeOptions = {},
  onProgress?: (pct: number, message: string) => void,
): Promise<Transcription> {
  const {
    model = 'base',
    language = 'auto',
  } = options;

  return await runPythonWhisper(audioPath, outputDir, model, language, onProgress);
}

/** Run Python whisper (openai-whisper) with spawn for progress */
async function runPythonWhisper(
  audioPath: string,
  outputDir: string,
  model: string,
  language: string,
  onProgress?: (pct: number, message: string) => void,
): Promise<Transcription> {
  const args = [
    '-m', 'whisper',
    audioPath,
    '--model', model,
    '--output_format', 'json',
    '--word_timestamps', 'True',
    '--output_dir', outputDir,
    '--verbose', 'True',
  ];

  if (language !== 'auto') {
    args.push('--language', language);
  }

  onProgress?.(5, `Loading Whisper ${model} model...`);

  return new Promise<Transcription>((resolve, reject) => {
    const proc = spawn('python', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    let lastPct = 5;

    // Parse progress from either stdout or stderr (whisper version-dependent)
    function handleOutput(chunk: Buffer) {
      const text = chunk.toString();
      stderr += text;

      // Parse progress from whisper verbose output
      // Lines look like: "[00:00.000 --> 00:04.220]  자, 이제 다음..."
      const tsMatch = text.match(/\[(\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}\.\d{3})\]/);
      if (tsMatch) {
        const endTs = tsMatch[2];
        const parts = endTs.split(':');
        const endSec = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
        const estPct = Math.min(90, Math.max(10, Math.round(10 + (endSec / 10) * 1)));
        if (estPct > lastPct) {
          lastPct = estPct;
          onProgress?.(estPct, `Transcribing... ${endTs}`);
        }
      }

      // Detect language
      const langMatch = text.match(/Detected language:\s*(\w+)/);
      if (langMatch) {
        onProgress?.(8, `Detected language: ${langMatch[1]}`);
      }
    }

    proc.stderr.on('data', handleOutput);
    proc.stdout.on('data', handleOutput);

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('Whisper timed out after 30 minutes'));
    }, 1800000); // 30 min

    proc.on('close', (code) => {
      clearTimeout(timeout);

      if (code !== 0) {
        reject(new Error(`Whisper exited with code ${code}: ${stderr.slice(-500)}`));
        return;
      }

      onProgress?.(95, 'Parsing transcription...');

      try {
        const audioName = path.basename(audioPath, path.extname(audioPath));
        const jsonPath = path.join(outputDir, audioName + '.json');
        const transcription = parsePythonWhisperOutput(jsonPath);
        onProgress?.(100, 'Transcription complete');
        resolve(transcription);
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start Whisper: ${err.message}`));
    });
  });
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
