import path from 'path';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { runFfmpeg, runFfmpegWithProgress, getDuration } from './ffmpeg';
import { getProjectPaths, ffmpegPath, ffmpegFilterPath, getFontsDir } from './paths';
import type { Clip, StoryMeta } from '@/types/project';

/** Qwen3 TTS server endpoint (local) */
const QWEN_TTS_URL = 'http://localhost:8000/tts';

/** Duration targets for each Act */
const ACT1_TARGET_SEC = 4;  // Title card + hook TTS
const ACT2_TARGET_SEC = 4;  // Buildup with volume ramp

/** BGM volume levels */
const BGM_VOLUME = 0.08;

/** Font for drawtext */
const TITLE_FONT = 'Pretendard-Bold';
const SUBTITLE_FONT = 'NotoSansKR-Bold';

type ProgressFn = (pct: number, msg: string) => void;

/**
 * Compose a 3-Act story version of a rendered clip.
 *
 * Act 1 (Setup):    Title card + TTS hook narration + ambient BGM
 * Act 2 (Buildup):  Context clip (slow or pre-clip) + TTS context + volume fade-in
 * Act 3 (Payoff):   Full rendered clip at full volume
 *
 * Returns the path to the final story MP4.
 */
export async function composeStory(
  projectId: string,
  clip: Clip,
  onProgress?: ProgressFn,
): Promise<string> {
  const paths = getProjectPaths(projectId);
  const storyDir = path.join(paths.root, 'story');
  mkdirSync(storyDir, { recursive: true });

  const storyMeta = clip.storyMeta;
  if (!storyMeta) {
    throw new Error(`Clip ${clip.id} has no storyMeta — run AI analysis first`);
  }

  const renderedPath = clip.renderedPath || path.join(paths.renderedDir, `${clip.id}_rendered.mp4`);
  if (!existsSync(renderedPath)) {
    throw new Error(`Rendered clip not found: ${renderedPath}`);
  }

  const prefix = path.join(storyDir, clip.id);
  const outputPath = `${prefix}_story.mp4`;

  onProgress?.(5, 'Generating TTS narration (Qwen3)...');

  // --- TTS via Qwen3 local server: combine hook + context into one call ---
  const combinedText = `${storyMeta.hook}. ... ${storyMeta.context}`;
  const ttsWavPath = `${prefix}_tts_combined.wav`;
  let ttsAvailable = false;

  try {
    await generateTtsQwen(combinedText, ttsWavPath);
    ttsAvailable = true;
  } catch (err) {
    console.warn(`[story-composer] TTS failed, using silent fallback: ${err instanceof Error ? err.message : err}`);
  }

  const hookWav = `${prefix}_hook.wav`;
  const contextWav = `${prefix}_context.wav`;
  let hookDuration: number;
  let contextDuration: number;

  if (ttsAvailable) {
    const ttsDuration = await getDuration(ttsWavPath);
    // Split TTS: hook ≈ first 40%, context ≈ remaining 60%
    hookDuration = Math.min(ACT1_TARGET_SEC, ttsDuration * 0.4);
    const contextStart = hookDuration;
    contextDuration = ttsDuration - contextStart;

    await Promise.all([
      runFfmpeg([
        '-y', '-i', ttsWavPath,
        '-t', hookDuration.toFixed(2),
        '-c', 'copy', hookWav,
      ]),
      runFfmpeg([
        '-y', '-i', ttsWavPath,
        '-ss', contextStart.toFixed(2),
        '-c', 'copy', contextWav,
      ]),
    ]);
  } else {
    // Generate silent WAV files as fallback
    hookDuration = ACT1_TARGET_SEC;
    contextDuration = ACT2_TARGET_SEC;

    await Promise.all([
      runFfmpeg(['-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', hookDuration.toFixed(2), hookWav]),
      runFfmpeg(['-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', contextDuration.toFixed(2), contextWav]),
    ]);
  }

  onProgress?.(20, 'Building Act 1 (Title Card)...');

  // === ACT 1: Title Card ===
  const act1Path = `${prefix}_act1.mp4`;
  const act1Duration = Math.max(ACT1_TARGET_SEC, hookDuration + 0.5);
  await buildAct1(act1Path, act1Duration, hookWav, storyMeta, clip);

  onProgress?.(45, 'Building Act 2 (Buildup)...');

  // === ACT 2: Buildup ===
  const act2Path = `${prefix}_act2.mp4`;
  const act2Duration = Math.min(8, Math.max(ACT2_TARGET_SEC, contextDuration + 0.5));
  await buildAct2(act2Path, act2Duration, contextWav, renderedPath, storyMeta, clip);

  onProgress?.(70, 'Building Act 3 (Payoff)...');

  // === ACT 3: Payoff (extract from source + render as 9:16) ===
  const act3Path = `${prefix}_act3.mp4`;
  await buildAct3(act3Path, paths.source, clip);

  onProgress?.(85, 'Concatenating 3 Acts...');

  // === CONCAT ===
  const concatListPath = `${prefix}_concat.txt`;
  writeFileSync(concatListPath, [
    `file '${ffmpegPath(act1Path)}'`,
    `file '${ffmpegPath(act2Path)}'`,
    `file '${ffmpegPath(act3Path)}'`,
  ].join('\n'));

  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart',
    outputPath,
  ]);

  onProgress?.(95, 'Cleaning up temp files...');

  // Cleanup intermediate files
  const tempFiles = [
    ttsWavPath, hookWav, contextWav,
    act1Path, act2Path, act3Path,
    concatListPath,
  ];
  for (const f of tempFiles) {
    try { unlinkSync(f); } catch { /* ignore */ }
  }

  onProgress?.(100, 'Story composed!');
  return outputPath;
}

/**
 * Act 1 — Setup: Dark background + title text + hook TTS + ambient BGM
 */
async function buildAct1(
  outputPath: string,
  duration: number,
  hookWavPath: string,
  story: StoryMeta,
  clip: Clip,
): Promise<void> {
  const w = 1080;
  const h = 1920;
  const fontsDir = ffmpegFilterPath(getFontsDir());

  // Escape text for drawtext (single quotes and colons)
  const titleText = escapeDrawtext(clip.title);
  const hookText = escapeDrawtext(story.hook);

  // Use emotionalArc to pick a tint color
  const tintColor = arcToColor(story.emotionalArc);

  const filter = [
    // Dark background with subtle color tint
    `color=c=0x0a0e1a:s=${w}x${h}:d=${duration}:r=30[bg]`,

    // Thin colored accent line at top
    `color=c=${tintColor}:s=${w}x4:d=${duration}:r=30[line]`,
    `[bg][line]overlay=0:80[bg2]`,

    // Title text (large, centered upper third)
    `[bg2]drawtext=fontfile='${fontsDir}/${TITLE_FONT}.otf':text='${titleText}':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h/3)-text_h:enable='between(t,0.3,${duration})'[bg3]`,

    // Hook text (smaller, centered below title)
    `[bg3]drawtext=fontfile='${fontsDir}/${SUBTITLE_FONT}.ttf':text='${hookText}':fontcolor=0xcccccc:fontsize=32:x=(w-text_w)/2:y=(h/3)+40:enable='between(t,0.5,${duration})'[vout]`,

    // Audio: TTS hook + ambient BGM (sine tone + noise)
    `anoisesrc=d=${duration}:c=pink:r=44100:a=0.003[noise]`,
    `sine=f=120:d=${duration}:r=44100,volume=${BGM_VOLUME}[drone]`,
    `[noise][drone]amix=inputs=2:duration=first[bgm]`,

    // Mix TTS + BGM
    `[1:a]aresample=44100,volume=1.0[tts]`,
    `[tts][bgm]amix=inputs=2:duration=longest:weights=1 0.3[mixed]`,

    // Fade out audio at end
    `[mixed]afade=t=out:st=${(duration - 0.5).toFixed(2)}:d=0.5[aout]`,
  ].join(';\n');

  const filterPath = outputPath.replace('.mp4', '_filter.txt');
  writeFileSync(filterPath, filter);

  await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=0x0a0e1a:s=${w}x${h}:d=${duration}:r=30`,
    '-i', hookWavPath,
    '-filter_complex_script', filterPath,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', duration.toFixed(2),
    outputPath,
  ]);

  try { unlinkSync(filterPath); } catch { /* ignore */ }
}

/**
 * Act 2 — Buildup: Dark background + context TTS + shareHook subtitle + rising BGM
 * Uses color source (no video decode) for maximum reliability.
 */
async function buildAct2(
  outputPath: string,
  duration: number,
  contextWavPath: string,
  _renderedPath: string,
  story: StoryMeta,
  _clip: Clip,
): Promise<void> {
  const w = 1080;
  const h = 1920;
  const fontsDir = ffmpegFilterPath(getFontsDir());

  const shareText = escapeDrawtext(story.shareHook);
  const contextText = escapeDrawtext(story.context.slice(0, 60) + '...');
  const tintColor = arcToColor(story.emotionalArc);

  const filter = [
    // Dark background — slightly lighter than Act 1 to show progression
    `color=c=0x0f1525:s=${w}x${h}:d=${duration}:r=30[bg]`,

    // Colored accent bar (thicker, pulsing feel via fade)
    `color=c=${tintColor}:s=${w}x6:d=${duration}:r=30[line]`,
    `[bg][line]overlay=0:h/2-3[bg2]`,

    // Context preview text (upper area, smaller)
    `[bg2]drawtext=fontfile='${fontsDir}/${SUBTITLE_FONT}.ttf':text='${contextText}':fontcolor=0x888888:fontsize=28:x=(w-text_w)/2:y=h/3:enable='between(t,0.3,${duration})'[bg3]`,

    // shareHook subtitle (bottom, prominent)
    `[bg3]drawtext=fontfile='${fontsDir}/${SUBTITLE_FONT}.ttf':text='${shareText}':fontcolor=white:fontsize=42:x=(w-text_w)/2:y=h*2/3:enable='between(t,0.8,${duration})':borderw=2:bordercolor=black@0.5[vout]`,

    // Context TTS narration
    `[1:a]aresample=44100,volume=0.9[tts]`,

    // BGM ambient — slightly more intense than Act 1
    `anoisesrc=d=${duration}:c=pink:r=44100:a=0.004[noise]`,
    `sine=f=180:d=${duration}:r=44100,volume=0.06[drone]`,
    `[noise][drone]amix=inputs=2:duration=first[bgm]`,

    // Mix TTS + BGM
    `[tts][bgm]amix=inputs=2:duration=longest:weights=1 0.3[mixed]`,

    // Volume ramp: rises through Act 2
    `[mixed]volume='0.4+0.6*t/${duration.toFixed(2)}':eval=frame[aout]`,
  ].join(';\n');

  const filterPath = outputPath.replace('.mp4', '_filter.txt');
  writeFileSync(filterPath, filter);

  await runFfmpeg([
    '-y',
    '-f', 'lavfi', '-i', `color=c=0x0f1525:s=${w}x${h}:d=${duration}:r=30`,
    '-i', contextWavPath,
    '-filter_complex_script', filterPath,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    '-t', duration.toFixed(2),
    outputPath,
  ]);

  try { unlinkSync(filterPath); } catch { /* ignore */ }
}

/**
 * Act 3 — Payoff: Extract clip range from source, render as 9:16, brief volume fade-in
 * Uses source video directly to avoid corrupt rendered clip NAL issues.
 */
async function buildAct3(
  outputPath: string,
  sourcePath: string,
  clip: Clip,
): Promise<void> {
  const w = 1080;
  const h = 1920;
  const duration = clip.endSec - clip.startSec;

  // Extract from source, scale to 9:16, force 30fps to match Acts 1/2
  await runFfmpeg([
    '-y',
    '-ss', clip.startSec.toString(),
    '-i', sourcePath,
    '-t', duration.toString(),
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
    '-af', "volume='min(1.0, 0.7+0.6*t)':eval=frame",
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
    '-c:a', 'aac', '-b:a', '192k',
    outputPath,
  ]);
}

/**
 * Compose stories for all clips in a project.
 */
export async function composeAllStories(
  projectId: string,
  clips: Clip[],
  onProgress?: (current: number, total: number, clipTitle: string) => void,
): Promise<Clip[]> {
  const results: Clip[] = [];
  const storyClips = clips.filter(c => c.storyMeta && c.renderedPath);

  for (let i = 0; i < storyClips.length; i++) {
    const clip = storyClips[i];
    onProgress?.(i + 1, storyClips.length, clip.title);

    const storyPath = await composeStory(projectId, clip);
    results.push({ ...clip, storyPath, status: 'story-composed' });
  }

  // Return all clips (story-composed ones + unchanged ones)
  const storyIds = new Set(results.map(r => r.id));
  return clips.map(c => storyIds.has(c.id) ? results.find(r => r.id === c.id)! : c);
}

/**
 * Generate TTS audio via local Qwen3 TTS server.
 * POST http://localhost:8000/tts → WAV binary response.
 */
async function generateTtsQwen(text: string, outputPath: string): Promise<void> {
  const res = await fetch(QWEN_TTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language: 'Korean' }),
  });

  if (!res.ok) {
    throw new Error(`Qwen TTS error: ${res.status} ${await res.text()}`);
  }

  const arrayBuf = await res.arrayBuffer();
  writeFileSync(outputPath, Buffer.from(arrayBuf));
}

/** Escape text for ffmpeg drawtext filter */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\\\\\''")
    .replace(/:/g, '\\:')
    .replace(/%/g, '%%')
    .replace(/\n/g, ' ');
}

/** Map emotional arc to accent color for title card */
function arcToColor(arc: StoryMeta['emotionalArc']): string {
  const colors: Record<StoryMeta['emotionalArc'], string> = {
    triumph:    '0xfbbf24', // amber/gold
    surprise:   '0x8b5cf6', // purple
    heartbreak: '0xef4444', // red
    humor:      '0x22d3ee', // cyan
    tension:    '0xf97316', // orange
  };
  return colors[arc] || '0x8b5cf6';
}
