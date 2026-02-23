import { downloadVideo, readMetadata, isValidYouTubeUrl } from './ytdlp';
import { extractAudio } from './ffmpeg';
import { transcribe } from './whisper';
import { detectSilence } from './silence-detect';
import { analyzeHighlights } from './ai-analyze';
import { extractAllClips } from './clip-extractor';
import { renderAllClips } from './template-renderer';
import { composeAllStories } from './story-composer';
import { getProjectPaths, fileReady } from './paths';
import { writeFileSync, readFileSync } from 'fs';
import type { SSEMessage } from '@/types/pipeline';

type ProgressCallback = (msg: SSEMessage) => void;

/**
 * Run the full ClipForge pipeline:
 * download → extract audio → transcribe → silence → analyze → extract-clips → render
 */
export async function runPipeline(
  projectId: string,
  url: string,
  onProgress: ProgressCallback,
): Promise<void> {
  const paths = getProjectPaths(projectId);

  // === Step 1: Download ===
  onProgress({ type: 'progress', stepId: 'download', progress: 0, message: 'Starting download...' });

  if (!isValidYouTubeUrl(url)) {
    throw new Error('Invalid YouTube URL');
  }

  await downloadVideo(url, paths.source, (pct, msg) => {
    onProgress({ type: 'progress', stepId: 'download', progress: pct, message: msg });
  });

  const metadata = readMetadata(paths.root);
  writeFileSync(paths.metadata, JSON.stringify(metadata, null, 2));
  onProgress({ type: 'step-complete', stepId: 'download', message: `Downloaded: ${metadata.title}`, data: metadata });

  // === Step 2: Extract Audio ===
  onProgress({ type: 'progress', stepId: 'extract-audio', progress: 0, message: 'Extracting audio (16kHz mono)...' });

  if (!fileReady(paths.audio)) {
    await extractAudio(paths.source, paths.audio);
  }

  onProgress({ type: 'step-complete', stepId: 'extract-audio', message: 'Audio extracted' });

  // === Step 3: Transcribe ===
  onProgress({ type: 'progress', stepId: 'transcribe', progress: 0, message: 'Transcribing with Whisper...' });

  let transcription;
  if (fileReady(paths.transcript)) {
    // Reuse existing transcript
    transcription = JSON.parse(readFileSync(paths.transcript, 'utf-8'));
    onProgress({ type: 'progress', stepId: 'transcribe', progress: 100, message: 'Using cached transcript' });
  } else {
    transcription = await transcribe(paths.audio, paths.root, {
      model: 'base',
      language: 'auto',
    }, (pct, msg) => {
      onProgress({ type: 'progress', stepId: 'transcribe', progress: pct, message: msg });
    });

    writeFileSync(paths.transcript, JSON.stringify(transcription, null, 2));
  }
  onProgress({
    type: 'step-complete',
    stepId: 'transcribe',
    message: `Transcribed: ${transcription.segments.length} segments (${transcription.language})`,
    data: { segmentCount: transcription.segments.length, language: transcription.language },
  });

  // === Step 4: Detect Silence ===
  onProgress({ type: 'progress', stepId: 'detect-silence', progress: 0, message: 'Detecting silence gaps...' });

  const silenceGaps = await detectSilence(paths.audio);
  writeFileSync(paths.silence, JSON.stringify(silenceGaps, null, 2));

  const totalSilence = silenceGaps.reduce((sum, g) => sum + g.duration, 0);
  onProgress({
    type: 'step-complete',
    stepId: 'detect-silence',
    message: `Found ${silenceGaps.length} silence gaps (${totalSilence.toFixed(1)}s total)`,
  });

  // === Step 5: AI Analysis ===
  onProgress({ type: 'progress', stepId: 'analyze', progress: 0, message: 'AI analyzing highlights...' });

  const clips = await analyzeHighlights(
    transcription,
    metadata.title,
    metadata.duration,
    projectId,
  );

  writeFileSync(paths.analysis, JSON.stringify(clips, null, 2));
  onProgress({
    type: 'step-complete',
    stepId: 'analyze',
    message: `Found ${clips.length} highlight clips`,
    data: { clipCount: clips.length },
  });

  // === Step 6: Extract Clips ===
  onProgress({ type: 'progress', stepId: 'extract-clips', progress: 0, message: 'Extracting clips...' });

  const extracted = await extractAllClips(projectId, clips, silenceGaps, (current, total, title) => {
    const pct = Math.round((current / total) * 100);
    onProgress({ type: 'progress', stepId: 'extract-clips', progress: pct, message: `Extracting: ${title} (${current}/${total})` });
  });

  writeFileSync(paths.analysis, JSON.stringify(extracted, null, 2));
  onProgress({
    type: 'step-complete',
    stepId: 'extract-clips',
    message: `Extracted ${extracted.length} clips`,
  });

  // === Step 7: Render ===
  onProgress({ type: 'progress', stepId: 'render', progress: 0, message: 'Rendering short-form clips...' });

  const rendered = await renderAllClips(projectId, extracted, (current, total, title) => {
    const pct = Math.round((current / total) * 100);
    onProgress({ type: 'progress', stepId: 'render', progress: pct, message: `Rendering: ${title} (${current}/${total})` });
  });

  writeFileSync(paths.analysis, JSON.stringify(rendered, null, 2));
  onProgress({
    type: 'step-complete',
    stepId: 'render',
    message: `Rendered ${rendered.length} clips`,
  });

  // === Step 8: Story Compose ===
  const hasStoryMeta = rendered.some(c => c.storyMeta);
  if (hasStoryMeta) {
    onProgress({ type: 'progress', stepId: 'story-compose', progress: 0, message: 'Composing stories...' });

    const storied = await composeAllStories(projectId, rendered, (current, total, title) => {
      const pct = Math.round((current / total) * 100);
      onProgress({ type: 'progress', stepId: 'story-compose', progress: pct, message: `Story: ${title} (${current}/${total})` });
    });

    writeFileSync(paths.analysis, JSON.stringify(storied, null, 2));
    onProgress({
      type: 'step-complete',
      stepId: 'story-compose',
      message: `Composed ${storied.filter(c => c.storyPath).length} story clips`,
    });
  } else {
    onProgress({
      type: 'step-complete',
      stepId: 'story-compose',
      message: 'Skipped — no story metadata',
    });
  }
}
