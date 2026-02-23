'use client';

import { usePipelineStore } from '@/stores/pipelineStore';

const STEP_ICONS: Record<string, string> = {
  download: '1',
  'extract-audio': '2',
  transcribe: '3',
  'detect-silence': '4',
  analyze: '5',
  'extract-clips': '6',
  render: '7',
};

export default function ProcessingStatus() {
  const { steps, isRunning, error } = usePipelineStore();

  const completedCount = steps.filter(s => s.status === 'done').length;
  const totalProgress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      {/* Overall progress bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-text-muted">
            {isRunning ? 'Processing...' : error ? 'Error' : completedCount === steps.length ? 'Complete' : 'Ready'}
          </span>
          <span className="text-sm text-primary font-mono">{totalProgress}%</span>
        </div>
        <div className="h-2 bg-surface rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              error ? 'bg-danger' : 'bg-primary'
            } ${isRunning ? 'animate-progress-pulse' : ''}`}
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="space-y-3">
        {steps.map(step => (
          <div
            key={step.id}
            className={`flex items-center gap-4 px-4 py-3 rounded-lg border transition-colors ${
              step.status === 'running'
                ? 'border-primary/40 bg-primary-dim'
                : step.status === 'done'
                ? 'border-success/30 bg-success/5'
                : step.status === 'error'
                ? 'border-danger/30 bg-danger/5'
                : 'border-border bg-surface'
            }`}
          >
            {/* Step number */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              step.status === 'running'
                ? 'bg-primary text-bg'
                : step.status === 'done'
                ? 'bg-success text-bg'
                : step.status === 'error'
                ? 'bg-danger text-bg'
                : 'bg-border text-text-muted'
            }`}>
              {step.status === 'done' ? '\u2713' : step.status === 'error' ? '!' : STEP_ICONS[step.id]}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{step.name}</div>
              {step.message && (
                <div className="text-xs text-text-muted truncate">{step.message}</div>
              )}
            </div>

            {/* Step progress */}
            {step.status === 'running' && (
              <div className="text-sm text-primary font-mono">{step.progress}%</div>
            )}
          </div>
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-danger/10 border border-danger/30 rounded-lg">
          <p className="text-danger text-sm font-medium">Error</p>
          <p className="text-danger/80 text-sm mt-1">{error}</p>
        </div>
      )}
    </div>
  );
}
