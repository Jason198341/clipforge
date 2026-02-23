import { writeFileSync } from 'fs';
import type { TranscriptSegment, TranscriptWord } from '@/types/project';
import type { CaptionStyle } from '@/types/template';

/**
 * Generate ASS subtitle file from transcript segments.
 * Uses word-level timestamps when available for accurate sync.
 */
export function generateAss(
  segments: TranscriptSegment[],
  outputPath: string,
  width: number,
  height: number,
  style: CaptionStyle,
): void {
  const marginV = style.marginBottom;
  const alignment = style.position === 'top' ? 8 : style.position === 'center' ? 5 : 2;

  // Convert hex colors to ASS format (&HAABBGGRR)
  const primaryColor = hexToAss(style.fontColor);
  const outlineColor = hexToAss(style.outlineColor);
  const backColor = style.backgroundColor ? hexToAss(style.backgroundColor) : '&H80000000';

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${style.fontSize},${primaryColor},&H000000FF,${outlineColor},${backColor},-1,0,0,0,100,100,0,0,${style.backgroundColor ? 3 : 1},${style.outlineWidth},${style.shadowOffset || 0},${alignment},40,40,${marginV},1
`;

  const dialogues: string[] = [];

  for (const seg of segments) {
    // Split text into lines respecting maxCharsPerLine
    const lines = smartSplit(seg.text, style.maxCharsPerLine);

    if (seg.words && seg.words.length > 0) {
      // Word-level timing: distribute lines across word timestamps
      const wordLines = distributeWordsToLines(seg.words, style.maxCharsPerLine);
      for (const wl of wordLines) {
        const start = formatAssTime(wl.start);
        const end = formatAssTime(wl.end);
        dialogues.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${escapeAssText(wl.text)}`);
      }
    } else {
      // Segment-level timing: distribute proportionally
      const totalLen = lines.reduce((s, l) => s + l.length, 0);
      let cursor = seg.start;

      for (const line of lines) {
        const ratio = line.length / totalLen;
        const lineDuration = (seg.end - seg.start) * ratio;
        const start = formatAssTime(cursor);
        const end = formatAssTime(cursor + lineDuration);
        dialogues.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${escapeAssText(line)}`);
        cursor += lineDuration;
      }
    }
  }

  const content = header + '\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n' + dialogues.join('\n') + '\n';
  writeFileSync(outputPath, content, 'utf-8');
}

/** Distribute words into lines with timing */
function distributeWordsToLines(
  words: TranscriptWord[],
  maxChars: number,
): Array<{ text: string; start: number; end: number }> {
  const lines: Array<{ text: string; start: number; end: number }> = [];
  let currentLine = '';
  let lineStart = words[0]?.start ?? 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = currentLine ? `${currentLine} ${word.word}` : word.word;

    if (candidate.length > maxChars && currentLine) {
      // Flush current line
      lines.push({
        text: currentLine.trim(),
        start: lineStart,
        end: words[i - 1]?.end ?? word.start,
      });
      currentLine = word.word;
      lineStart = word.start;
    } else {
      currentLine = candidate;
    }
  }

  // Flush last line
  if (currentLine.trim()) {
    lines.push({
      text: currentLine.trim(),
      start: lineStart,
      end: words[words.length - 1]?.end ?? lineStart + 1,
    });
  }

  return lines;
}

/** Smart text splitting at natural break points */
function smartSplit(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text];

  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > maxChars) {
    let breakIdx = -1;

    // Try sentence boundaries
    for (const sep of ['. ', '! ', '? ', ', ', ' ']) {
      const idx = remaining.lastIndexOf(sep, maxChars);
      if (idx > maxChars * 0.3) {
        breakIdx = idx + (sep === ' ' ? 0 : sep.length - 1);
        break;
      }
    }

    if (breakIdx <= 0) breakIdx = maxChars;

    lines.push(remaining.slice(0, breakIdx).trim());
    remaining = remaining.slice(breakIdx).trim();
  }

  if (remaining) lines.push(remaining);
  return lines;
}

/** Format seconds to ASS timestamp: H:MM:SS.cc */
function formatAssTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const cs = Math.round((sec % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

/** Convert hex color (#RRGGBB or #RRGGBBAA) to ASS (&HAABBGGRR) */
function hexToAss(hex: string): string {
  const clean = hex.replace('#', '');
  let r: string, g: string, b: string, a: string;

  if (clean.length === 8) {
    r = clean.slice(0, 2);
    g = clean.slice(2, 4);
    b = clean.slice(4, 6);
    a = clean.slice(6, 8);
  } else {
    r = clean.slice(0, 2);
    g = clean.slice(2, 4);
    b = clean.slice(4, 6);
    a = '00';
  }

  return `&H${a}${b}${g}${r}`;
}

/** Escape special ASS characters */
function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}
