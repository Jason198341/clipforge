import { runFfmpegWithProgress } from './ffmpeg';
import { generateAss } from './subtitles';
import { getProjectPaths, ffmpegPath, ffmpegFilterPath, getFontsDir } from './paths';
import { getTemplate } from '@/data/templates';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import type { Clip, TranscriptSegment } from '@/types/project';
import type { Template } from '@/types/template';

/**
 * Render a single clip with the specified template.
 * Produces a 1080x1920 vertical short-form video with subtitles.
 */
export async function renderClip(
  projectId: string,
  clip: Clip,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const paths = getProjectPaths(projectId);
  const template = getTemplate(clip.templateId);
  const outputPath = path.join(paths.renderedDir, `${clip.id}_rendered.mp4`);

  // Load transcript segments for this clip's time range
  const transcription = JSON.parse(readFileSync(paths.transcript, 'utf-8'));
  const clipSegments = getSegmentsInRange(
    transcription.segments,
    clip.startSec,
    clip.endSec,
  );

  // Generate ASS subtitle file
  const assPath = path.join(paths.renderedDir, `${clip.id}.ass`);
  generateAss(clipSegments, assPath, template.layout.width, template.layout.height, template.caption);

  // Build ffmpeg filter_complex
  const filter = buildFilterComplex(template, assPath, clip);

  // Write filter to file (avoid shell escaping issues)
  const filterPath = path.join(paths.renderedDir, `${clip.id}_filter.txt`);
  writeFileSync(filterPath, filter);

  const clipDuration = clip.endSec - clip.startSec;
  const sourcePath = clip.sourcePath || paths.source;

  const args = [
    '-y',
    '-i', sourcePath,
    '-filter_complex_script', filterPath,
    '-map', '[vout]',
    '-map', '[aout]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '22',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    '-t', clipDuration.toString(),
    outputPath,
  ];

  await runFfmpegWithProgress(args, clipDuration, (pct) => {
    onProgress?.(pct);
  });

  // Clean up filter file
  try { require('fs').unlinkSync(filterPath); } catch { /* ignore */ }

  return outputPath;
}

/**
 * Build ffmpeg filter_complex string based on template.
 */
function buildFilterComplex(template: Template, assPath: string, clip: Clip): string {
  const { layout, overlay } = template;
  const { width, height } = layout;
  const filters: string[] = [];
  // For ASS filter: use single quotes around path to handle Windows colons
  const escapedAssPath = ffmpegFilterPath(assPath).replace(/'/g, "'\\''");
  const fontsDir = ffmpegFilterPath(getFontsDir()).replace(/'/g, "'\\''");

  // Input: [0:v] and [0:a]
  let videoLabel = '0:v';
  let audioLabel = '0:a';

  if (layout.background === 'blur') {
    // Blur-fill layout: need to split input since we reference it twice
    filters.push(`[${videoLabel}]split=2[bg_in][fg_in]`);

    // Background: scale to fill + blur
    filters.push(`[bg_in]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=${layout.blurRadius || 40}:${Math.floor((layout.blurRadius || 40) / 2)}[bg]`);

    // Foreground: scale to fit within video area
    const videoH = Math.round(height * layout.videoScale);
    const videoW = width;
    filters.push(`[fg_in]scale=${videoW}:${videoH}:force_original_aspect_ratio=decrease,pad=${videoW}:${videoH}:(ow-iw)/2:(oh-ih)/2:color=black@0[fg]`);

    // Overlay centered
    const yOffset = Math.round((height - videoH) / 2);
    filters.push(`[bg][fg]overlay=0:${yOffset}[composed]`);

    videoLabel = 'composed';
  } else if (layout.background === 'black' || layout.background === 'color') {
    // Solid background + scaled video
    const bgColor = layout.backgroundTint || '0x000000';
    const videoH = Math.round(height * layout.videoScale);

    if (layout.videoPosition === 'fill') {
      // Scale + crop to fill entire frame
      filters.push(`[${videoLabel}]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}[composed]`);
    } else if (layout.videoPosition === 'top') {
      // Video at top, color bg fills rest
      filters.push(`[${videoLabel}]scale=${width}:${videoH}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:0:color=${bgColor}[composed]`);
    } else {
      // Centered
      const yOffset = Math.round((height - videoH) / 2);
      filters.push(`[${videoLabel}]scale=${width}:${videoH}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:${yOffset}:color=${bgColor}[composed]`);
    }

    videoLabel = 'composed';
  }

  // Apply gradient overlay if configured
  if (overlay?.gradient) {
    // Use color source + alphamerge for gradient effect
    const gradDir = overlay.gradient.direction === 'top' ? 'y' : `(H-y)`;
    filters.push(`color=black:${width}x${height},format=gbrp,geq=lum=128:a='${gradDir}/H*255*${overlay.gradient.opacity}'[grad]`);
    filters.push(`[${videoLabel}][grad]overlay=0:0[graded]`);
    videoLabel = 'graded';
  }

  // Apply border if configured
  if (overlay?.border) {
    const bw = overlay.border.width;
    const color = overlay.border.color.replace('#', '0x');
    filters.push(`[${videoLabel}]drawbox=x=0:y=0:w=${width}:h=${height}:color=${color}:t=${bw}[bordered]`);
    videoLabel = 'bordered';
  }

  // Apply ASS subtitles (use ' for paths with Windows drive colons)
  filters.push(`[${videoLabel}]ass='${escapedAssPath}':fontsdir='${fontsDir}'[vout]`);

  // Audio passthrough
  filters.push(`[${audioLabel}]acopy[aout]`);

  return filters.join(';\n');
}

/** Get transcript segments within a time range, adjusting timestamps to be clip-relative */
function getSegmentsInRange(
  segments: TranscriptSegment[],
  startSec: number,
  endSec: number,
): TranscriptSegment[] {
  return segments
    .filter(s => s.end > startSec && s.start < endSec)
    .map(s => ({
      ...s,
      start: Math.max(0, s.start - startSec),
      end: Math.min(endSec - startSec, s.end - startSec),
      text: s.text,
      words: s.words?.map(w => ({
        ...w,
        start: Math.max(0, w.start - startSec),
        end: Math.min(endSec - startSec, w.end - startSec),
      })),
    }));
}

/**
 * Render all clips for a project.
 */
export async function renderAllClips(
  projectId: string,
  clips: Clip[],
  onProgress?: (current: number, total: number, clipTitle: string) => void,
): Promise<Clip[]> {
  const results: Clip[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    onProgress?.(i + 1, clips.length, clip.title);

    const renderedPath = await renderClip(projectId, clip);
    results.push({ ...clip, renderedPath, status: 'rendered' });
  }

  return results;
}
