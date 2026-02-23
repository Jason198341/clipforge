export interface Project {
  id: string;
  title: string;
  url: string;
  thumbnailUrl?: string;
  channelName?: string;
  duration?: number; // seconds
  status: PipelineStatus;
  clips: Clip[];
  transcription?: Transcription;
  createdAt: number;
  updatedAt: number;
}

export type PipelineStatus =
  | 'idle'
  | 'downloading'
  | 'extracting-audio'
  | 'transcribing'
  | 'detecting-silence'
  | 'analyzing'
  | 'extracting-clips'
  | 'rendering'
  | 'story-composing'
  | 'done'
  | 'error';

export interface StoryMeta {
  hook: string;           // "이 영상을 봐야 하는 이유" (1문장, TTS용)
  context: string;        // 배경 설명 내레이션 (2-3문장, TTS용)
  payoffFrame: string;    // 클라이맥스 순간 설명 (1문장, TTS용)
  emotionalArc: 'triumph' | 'surprise' | 'heartbreak' | 'humor' | 'tension';
  shareHook: string;      // "친구한테 말해줘야 할 한마디" (자막용)
}

export interface Clip {
  id: string;
  projectId: string;
  title: string;
  description: string;
  startSec: number;
  endSec: number;
  viralScore: number; // 1-10
  reason: string;
  tags: string[];
  templateId: string;
  sourcePath?: string; // raw extracted clip
  renderedPath?: string; // after template render
  hookingPath?: string; // with TTS hook prepended
  storyMeta?: StoryMeta;  // 3-Act storytelling metadata
  storyPath?: string;     // 3-Act composed result
  captionEdits?: CaptionEdit[];
  status: ClipStatus;
}

export type ClipStatus = 'pending' | 'extracted' | 'rendered' | 'story-composed' | 'uploaded';

export interface CaptionEdit {
  index: number;
  startSec: number;
  endSec: number;
  text: string;
}

export interface Transcription {
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface TranscriptWord {
  start: number;
  end: number;
  word: string;
  probability?: number;
}

export interface SilenceGap {
  start: number;
  end: number;
  duration: number;
}

export interface VideoMetadata {
  title: string;
  channelName: string;
  duration: number;
  thumbnailUrl: string;
  description: string;
}

export interface PipelineProgress {
  projectId: string;
  status: PipelineStatus;
  progress: number; // 0-100
  message: string;
  error?: string;
}
