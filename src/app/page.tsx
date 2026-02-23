'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UrlInput from '@/components/url-input';
import ProcessingStatus from '@/components/processing-status';
import { usePipelineStore } from '@/stores/pipelineStore';
import { useProjectStore } from '@/stores/projectStore';

export default function Home() {
  const router = useRouter();
  const { isRunning, steps, startPipeline, projectId } = usePipelineStore();
  const { createProject, loadFromStorage } = useProjectStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const hasStarted = steps.some(s => s.status !== 'pending');
  const isDone = steps.every(s => s.status === 'done' || s.status === 'skipped');

  function handleSubmit(url: string) {
    const project = createProject(url);
    startPipeline(project.id, url);
  }

  return (
    <div className="flex flex-col items-center">
      {/* Hero */}
      <div className="text-center mb-10 mt-8">
        <h1 className="text-4xl font-bold tracking-tight mb-3">
          <span className="text-primary">Clip</span>Forge
        </h1>
        <p className="text-text-muted text-lg max-w-lg mx-auto">
          Paste a YouTube URL. AI extracts viral short-form clips automatically.
        </p>
      </div>

      {/* URL Input */}
      <UrlInput onSubmit={handleSubmit} disabled={isRunning} />

      {/* Processing Status */}
      {hasStarted && <ProcessingStatus />}

      {/* Done state */}
      {isDone && hasStarted && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-success/10 border border-success/30 rounded-lg">
            <span className="text-success font-medium">Pipeline complete</span>
          </div>
          {projectId && (
            <button
              onClick={() => router.push(`/projects/${projectId}`)}
              className="mt-4 block mx-auto px-6 py-3 bg-primary hover:bg-primary-hover text-bg font-semibold rounded-lg transition-colors"
            >
              View Clips
            </button>
          )}
        </div>
      )}

      {/* Features */}
      {!hasStarted && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 w-full max-w-4xl">
          <FeatureCard
            number="1"
            title="Download & Transcribe"
            description="yt-dlp downloads the video, Whisper generates word-level transcription"
          />
          <FeatureCard
            number="2"
            title="AI Highlight Analysis"
            description="DeepSeek identifies 3-8 viral-worthy segments with scores and reasoning"
          />
          <FeatureCard
            number="3"
            title="Template Render"
            description="ffmpeg renders each clip as 9:16 short with subtitles and design"
          />
        </div>
      )}
    </div>
  );
}

function FeatureCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="p-6 bg-surface border border-border rounded-xl">
      <div className="w-10 h-10 bg-primary-dim rounded-lg flex items-center justify-center text-primary font-bold mb-3">
        {number}
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-text-muted">{description}</p>
    </div>
  );
}
