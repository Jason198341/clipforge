import path from 'path';
import { writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { runFfmpeg, runFfmpegWithProgress, getDuration } from './ffmpeg';
import { generateHook } from './hooking-tts';
import { getProjectPaths, ffmpegPath, ffmpegFilterPath, getFontsDir } from './paths';
import type { Clip, StoryMeta } from '@/types/project';

/** Duration targets for each Act */
const ACT1_TARGET_SEC = 4;  // Title card + hook TTS
const ACT2_TARGET_SEC = 4;  // Buildup with volume ramp

/** BGM volume levels */
const BGM_VOLUME = 0.08;

/** Font for drawtext */
const TITLE_FONT = 'Pretendard-Bold';
const SUBTITLE_FONT = 'Pretendard-Medium';

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

  onProgress?.(5, 'Generating TTS narration...');

  // --- TTS: combine hook + context into one call to save quota ---
  const combinedText = `${storyMeta.hook}\n\n...\n\n${storyMeta.context}`;
  const ttsWavPath = `${prefix}_tts_combined.wav`;
  await generateHook(combinedText, ttsWavPath);

  const ttsDuration = await getDuration(ttsWavPath);

  // Split TTS: hook ≈ first 40%, context ≈ remaining 60%
  const hookDuration = Math.min(ACT1_TARGET_SEC, ttsDuration * 0.4);
  const contextStart = hookDuration;
  const contextDuration = ttsDuration - contextStart;

  const hookWav = `${prefix}_hook.wav`;
  const contextWav = `${prefix}_context.wav`;

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

  onProgress?.(20, 'Building Act 1 (Title Card)...');

  // === ACT 1: Title Card ===
  const act1Path = `${prefix}_act1.mp4`;
  const act1Duration = Math.max(ACT1_TARGET_SEC, hookDuration + 0.5);
  await buildAct1(act1Path, act1Duration, hookWav, storyMeta, clip);

  onProgress?.(45, 'Building Act 2 (Buildup)...');

  // === ACT 2: Buildup ===
  const act2Path = `${prefix}_act2.mp4`;
  const act2Duration = Math.max(ACT2_TARGET_SEC, contextDuration + 0.5);
  await buildAct2(act2Path, act2Duration, contextWav, renderedPath, storyMeta, clip);

  onProgress?.(70, 'Building Act 3 (Payoff)...');

  // === ACT 3: Payoff (rendered clip with volume fade-in) ===
  const act3Path = `${prefix}_act3.mp4`;
  await buildAct3(act3Path, renderedPath);

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
    '-c', 'copy',
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
    `[bg3]drawtext=fontfile='${fontsDir}/${SUBTITLE_FONT}.otf':text='${hookText}':fontcolor=0xcccccc:fontsize=32:x=(w-text_w)/2:y=(h/3)+40:enable='between(t,0.5,${duration})'[vout]`,

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
 * Act 2 — Buildup: First seconds of rendered clip slowed down + context TTS + volume ramp
 */
async function buildAct2(
  outputPath: string,
  duration: number,
  contextWavPath: string,
  renderedPath: string,
  story: StoryMeta,
  clip: Clip,
): Promise<void> {
  const w = 1080;
  const h = 1920;
  const fontsDir = ffmpegFilterPath(getFontsDir());

  const shareText = escapeDrawtext(story.shareHook);

  // Use first few seconds of rendered clip, slowed to 0.5x for buildup effect
  const filter = [
    // Video: take first portion of rendered clip, slow to 0.5x
    `[0:v]trim=start=0:end=${(duration / 2).toFixed(2)},setpts=2*PTS,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[slow]`,

    // Darken the slowed video for text readability
    `[slow]colorbalance=bs=-0.2:bm=-0.1,eq=brightness=-0.15:contrast=1.1[dark]`,

    // shareHook subtitle at bottom
    `[dark]drawtext=fontfile='${fontsDir}/${SUBTITLE_FONT}.otf':text='${shareText}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h-200:enable='between(t,0.5,${duration})':borderw=2:bordercolor=black@0.5[vout]`,

    // Audio from rendered clip: start at 10% volume, ramp to 70%
    `[0:a]atrim=start=0:end=${(duration / 2).toFixed(2)},asetpts=PTS-STARTPTS,atempo=0.5,volume=0.1,afade=t=in:st=0:d=${duration.toFixed(2)}:start_volume=0.1:curve=log[clipaudio]`,

    // Context TTS
    `[1:a]aresample=44100,volume=0.9[tts]`,

    // BGM ambient
    `anoisesrc=d=${duration}:c=pink:r=44100:a=0.002[noise]`,
    `sine=f=150:d=${duration}:r=44100,volume=0.05[drone]`,
    `[noise][drone]amix=inputs=2:duration=first[bgm]`,

    // Mix all audio: TTS + clip audio (quiet) + BGM
    `[tts][clipaudio][bgm]amix=inputs=3:duration=longest:weights=1 0.5 0.2[mixed]`,

    // Volume ramp: overall volume rises through Act 2
    `[mixed]volume='0.3+0.7*t/${duration.toFixed(2)}':eval=frame[aout]`,
  ].join(';\n');

  const filterPath = outputPath.replace('.mp4', '_filter.txt');
  writeFileSync(filterPath, filter);

  await runFfmpeg([
    '-y',
    '-i', renderedPath,
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
 * Act 3 — Payoff: Full rendered clip with brief volume fade-in
 */
async function buildAct3(
  outputPath: string,
  renderedPath: string,
): Promise<void> {
  // Short audio fade-in from 0.7 → 1.0 over 0.5s, then full volume
  await runFfmpeg([
    '-y',
    '-i', renderedPath,
    '-af', 'afade=t=in:st=0:d=0.5:start_volume=0.7',
    '-c:v', 'copy',
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
