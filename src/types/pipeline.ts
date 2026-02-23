export interface PipelineStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  progress: number;
  message: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

export interface PipelineState {
  projectId: string;
  steps: PipelineStep[];
  currentStep: string | null;
  isRunning: boolean;
  startedAt?: number;
  completedAt?: number;
}

export const PIPELINE_STEPS = [
  { id: 'download', name: 'Download Video' },
  { id: 'extract-audio', name: 'Extract Audio' },
  { id: 'transcribe', name: 'Transcribe' },
  { id: 'detect-silence', name: 'Detect Silence' },
  { id: 'analyze', name: 'AI Analysis' },
  { id: 'extract-clips', name: 'Extract Clips' },
  { id: 'render', name: 'Render Shorts' },
  { id: 'story-compose', name: 'Story Compose' },
] as const;

export type PipelineStepId = (typeof PIPELINE_STEPS)[number]['id'];

export interface SSEMessage {
  type: 'progress' | 'step-complete' | 'error' | 'done';
  stepId?: string;
  progress?: number;
  message?: string;
  data?: unknown;
  error?: string;
}
