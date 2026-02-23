'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ClipGallery from '@/components/clip-gallery';
import ProcessingStatus from '@/components/processing-status';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { Clip, VideoMetadata } from '@/types/project';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { isRunning } = usePipelineStore();
  const [clips, setClips] = useState<Clip[]>([]);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  // Load clips from filesystem API
  useEffect(() => {
    async function loadClips() {
      try {
        const res = await fetch(`/api/clips?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setClips(data.clips || []);
          setMetadata(data.metadata || null);
        }
      } catch { /* ignore */ }
      setLoading(false);
    }
    loadClips();
  }, [projectId]);

  function handleSelectClip(clip: Clip) {
    router.push(`/projects/${projectId}/editor?clipId=${clip.id}`);
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-text-muted mt-4">Loading project...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Project header */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-text-muted hover:text-primary mb-3 inline-block"
        >
          &larr; Back
        </button>
        <h1 className="text-2xl font-bold">{metadata?.title || projectId}</h1>
        {metadata?.channelName && (
          <p className="text-sm text-text-muted mt-1">{metadata.channelName}</p>
        )}
      </div>

      {/* Processing status if running */}
      {isRunning && <ProcessingStatus />}

      {/* Clip gallery */}
      {clips.length > 0 ? (
        <ClipGallery clips={clips} onSelectClip={handleSelectClip} />
      ) : (
        !isRunning && (
          <div className="text-center py-16">
            <p className="text-text-muted text-lg">No clips found for this project.</p>
            <p className="text-text-muted text-sm mt-2">
              Go back and paste a YouTube URL to start processing.
            </p>
          </div>
        )
      )}

      {/* Render all button */}
      {clips.length > 0 && clips.some(c => c.status !== 'rendered') && (
        <div className="mt-6 text-center">
          <button
            onClick={async () => {
              await fetch('/api/render', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId }),
              });
            }}
            className="px-6 py-3 bg-primary hover:bg-primary-hover text-bg font-semibold rounded-lg transition-colors"
          >
            Render All Clips
          </button>
        </div>
      )}
    </div>
  );
}
