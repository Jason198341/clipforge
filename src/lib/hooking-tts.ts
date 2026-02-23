import path from 'path';
import { writeFileSync, existsSync } from 'fs';
import { runFfmpeg } from './ffmpeg';
import { getProjectPaths, ffmpegPath } from './paths';

const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const SAMPLE_RATE = 24000;
const BIT_DEPTH = 16;
const CHANNELS = 1;

/**
 * Generate a 2-4 second TTS hook voiceover using Gemini.
 * Returns path to the generated WAV file.
 */
export async function generateHook(
  text: string,
  outputPath: string,
  voice: string = 'Kore',
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  // Gemini TTS API (REST)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`Gemini TTS error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

  if (!audioData) {
    throw new Error('No audio data in Gemini response');
  }

  // Convert base64 PCM to WAV
  const pcmBuffer = Buffer.from(audioData, 'base64');
  const wavHeader = buildWavHeader(pcmBuffer.length);
  const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);
  writeFileSync(outputPath, wavBuffer);

  return outputPath;
}

/** Build WAV file header (24kHz, 16-bit, mono) */
function buildWavHeader(dataSize: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * CHANNELS * (BIT_DEPTH / 8);
  const blockAlign = CHANNELS * (BIT_DEPTH / 8);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);      // PCM chunk size
  header.writeUInt16LE(1, 20);       // PCM format
  header.writeUInt16LE(CHANNELS, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BIT_DEPTH, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);
  return header;
}

/**
 * Prepend a TTS hook to a rendered clip.
 * Creates a new video with: [hook audio over black/freeze] + [original clip]
 */
export async function prependHookToClip(
  projectId: string,
  clipId: string,
  hookText: string,
): Promise<string> {
  const paths = getProjectPaths(projectId);
  const renderedPath = path.join(paths.renderedDir, `${clipId}_rendered.mp4`);
  const hookWavPath = path.join(paths.renderedDir, `${clipId}_hook.wav`);
  const outputPath = path.join(paths.renderedDir, `${clipId}_hooked.mp4`);

  if (!existsSync(renderedPath)) {
    throw new Error('Rendered clip not found');
  }

  // 1. Generate TTS hook
  await generateHook(hookText, hookWavPath);

  // 2. Get hook duration
  const { getDuration } = require('./ffmpeg');
  const hookDuration = await getDuration(hookWavPath);

  // 3. Create hook video (freeze first frame + hook audio)
  const hookVideoPath = path.join(paths.renderedDir, `${clipId}_hook_video.mp4`);
  await runFfmpeg([
    '-y',
    '-i', renderedPath,
    '-i', hookWavPath,
    '-filter_complex',
    `[0:v]trim=start=0:end=0.04,loop=loop=${Math.ceil(hookDuration * 25)}:size=1:start=0,setpts=PTS-STARTPTS[hv];[1:a]aresample=44100[ha]`,
    '-map', '[hv]',
    '-map', '[ha]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', hookDuration.toString(),
    hookVideoPath,
  ]);

  // 4. Concat hook + original clip
  const concatList = path.join(paths.renderedDir, `${clipId}_hooklist.txt`);
  writeFileSync(concatList, [
    `file '${ffmpegPath(hookVideoPath)}'`,
    `file '${ffmpegPath(renderedPath)}'`,
  ].join('\n'));

  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatList,
    '-c', 'copy',
    outputPath,
  ]);

  // Clean up temp files
  for (const f of [hookWavPath, hookVideoPath, concatList]) {
    try { require('fs').unlinkSync(f); } catch { /* ignore */ }
  }

  return outputPath;
}
