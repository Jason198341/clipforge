'use client';

import { useEffect, useState, useCallback } from 'react';
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
  const [storyMode, setStoryMode] = useState(true);
  const [composingAll, setComposingAll] = useState(false);

  // Load clips from filesystem API
  const loadClips = useCallback(async () => {
    try {
      const res = await fetch(`/api/clips?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setClips(data.clips || []);
        setMetadata(data.metadata || null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [projectId]);

  useEffect(() => { loadClips(); }, [loadClips]);

  function handleSelectClip(clip: Clip) {
    router.push(`/projects/${projectId}/editor?clipId=${clip.id}`);
  }

  async function handleComposeStory(clip: Clip) {
    await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, clipId: clip.id }),
    });
    loadClips(); // Refresh to show updated status
  }

  async function handleComposeAll() {
    setComposingAll(true);
    await fetch('/api/story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    setComposingAll(false);
    loadClips();
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-text-muted mt-4">Loading project...</p>
      </div>
    );
  }

  const hasStoryMeta = clips.some(c => c.storyMeta);
  const hasRendered = clips.some(c => c.status === 'rendered' || c.status === 'story-composed');
  const allStoried = clips.every(c => c.storyPath || !c.storyMeta);
  const pendingStoryCount = clips.filter(c => c.storyMeta && !c.storyPath && c.renderedPath).length;

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

      {/* Story Mode toggle bar */}
      {hasStoryMeta && (
        <div className="flex items-center justify-between mb-4 p-3 bg-surface border border-border rounded-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStoryMode(!storyMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                storyMode ? 'bg-amber-500' : 'bg-surface-hover'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                storyMode ? 'translate-x-5' : ''
              }`} />
            </button>
            <span className="text-sm font-medium">
              Story Mode
              <span className="text-text-muted ml-2 font-normal">
                3-Act storytelling DNA
              </span>
            </span>
          </div>

          {storyMode && pendingStoryCount > 0 && hasRendered && (
            <button
              onClick={handleComposeAll}
              disabled={composingAll}
              className="px-4 py-1.5 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {composingAll ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin w-3 h-3 border border-amber-400 border-t-transparent rounded-full" />
                  Composing...
                </span>
              ) : (
                `Compose All (${pendingStoryCount})`
              )}
            </button>
          )}

          {allStoried && hasStoryMeta && (
            <span className="text-xs text-amber-400">All stories composed</span>
          )}
        </div>
      )}

      {/* Processing status if running */}
      {isRunning && <ProcessingStatus />}

      {/* Clip gallery */}
      {clips.length > 0 ? (
        <ClipGallery
          clips={clips}
          storyMode={storyMode}
          onSelectClip={handleSelectClip}
          onComposeStory={handleComposeStory}
        />
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
      {clips.length > 0 && clips.some(c => c.status !== 'rendered' && c.status !== 'story-composed') && (
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
