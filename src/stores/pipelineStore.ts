'use client';

import { create } from 'zustand';
import type { PipelineStep, SSEMessage } from '@/types/pipeline';
import { PIPELINE_STEPS } from '@/types/pipeline';
import type { PipelineStatus } from '@/types/project';

interface PipelineState {
  projectId: string | null;
  steps: PipelineStep[];
  currentStep: string | null;
  isRunning: boolean;
  error: string | null;

  // SSE connection
  eventSource: EventSource | null;

  // Actions
  startPipeline: (projectId: string, url: string) => void;
  stopPipeline: () => void;
  reset: () => void;
}

function initSteps(): PipelineStep[] {
  return PIPELINE_STEPS.map(s => ({
    id: s.id,
    name: s.name,
    status: 'pending',
    progress: 0,
    message: '',
  }));
}

export const usePipelineStore = create<PipelineState>((set, get) => ({
  projectId: null,
  steps: initSteps(),
  currentStep: null,
  isRunning: false,
  error: null,
  eventSource: null,

  startPipeline: (projectId: string, url: string) => {
    const { eventSource: existing } = get();
    if (existing) existing.close();

    set({
      projectId,
      steps: initSteps(),
      currentStep: null,
      isRunning: true,
      error: null,
    });

    // Start pipeline via POST, then listen to SSE for progress
    fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, url }),
    }).catch(err => {
      set({ error: err.message, isRunning: false });
    });

    // SSE listener
    const es = new EventSource(`/api/status?projectId=${projectId}`);

    es.onmessage = (event) => {
      const msg: SSEMessage = JSON.parse(event.data);
      const { steps } = get();

      if (msg.type === 'progress' && msg.stepId) {
        const updated = steps.map(s =>
          s.id === msg.stepId
            ? { ...s, status: 'running' as const, progress: msg.progress ?? s.progress, message: msg.message ?? s.message }
            : s
        );
        set({ steps: updated, currentStep: msg.stepId });
      }

      if (msg.type === 'step-complete' && msg.stepId) {
        const updated = steps.map(s =>
          s.id === msg.stepId
            ? { ...s, status: 'done' as const, progress: 100, message: msg.message ?? 'Done' }
            : s
        );
        set({ steps: updated });
      }

      if (msg.type === 'error') {
        const updated = steps.map(s =>
          s.id === msg.stepId
            ? { ...s, status: 'error' as const, message: msg.error ?? 'Error' }
            : s
        );
        set({ steps: updated, error: msg.error ?? 'Unknown error', isRunning: false });
        es.close();
      }

      if (msg.type === 'done') {
        set({ isRunning: false, currentStep: null });
        es.close();
      }
    };

    es.onerror = () => {
      // SSE auto-reconnects, but if pipeline is done, close
      if (!get().isRunning) es.close();
    };

    set({ eventSource: es });
  },

  stopPipeline: () => {
    const { eventSource } = get();
    if (eventSource) eventSource.close();
    set({ isRunning: false, eventSource: null, currentStep: null });
  },

  reset: () => {
    const { eventSource } = get();
    if (eventSource) eventSource.close();
    set({
      projectId: null,
      steps: initSteps(),
      currentStep: null,
      isRunning: false,
      error: null,
      eventSource: null,
    });
  },
}));

/** Map pipeline step IDs to project status */
export function stepToStatus(stepId: string | null): PipelineStatus {
  const map: Record<string, PipelineStatus> = {
    download: 'downloading',
    'extract-audio': 'extracting-audio',
    transcribe: 'transcribing',
    'detect-silence': 'detecting-silence',
    analyze: 'analyzing',
    'extract-clips': 'extracting-clips',
    render: 'rendering',
  };
  return stepId ? (map[stepId] || 'idle') : 'idle';
}
