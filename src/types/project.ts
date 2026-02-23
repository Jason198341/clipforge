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
  | 'done'
  | 'error';

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
  captionEdits?: CaptionEdit[];
  status: ClipStatus;
}

export type ClipStatus = 'pending' | 'extracted' | 'rendered' | 'uploaded';

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
