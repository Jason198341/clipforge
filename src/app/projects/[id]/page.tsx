'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProjectStore } from '@/stores/projectStore';
import ClipGallery from '@/components/clip-gallery';
import ProcessingStatus from '@/components/processing-status';
import { usePipelineStore } from '@/stores/pipelineStore';
import type { Clip } from '@/types/project';

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { projects, loadFromStorage, setCurrentProject } = useProjectStore();
  const { isRunning } = usePipelineStore();
  const [clips, setClips] = useState<Clip[]>([]);

  useEffect(() => {
    loadFromStorage();
    setCurrentProject(projectId);
  }, [projectId, loadFromStorage, setCurrentProject]);

  const project = projects.find(p => p.id === projectId);

  // Load clips from API
  useEffect(() => {
    async function loadClips() {
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        // Don't actually extract, just read saved analysis
      } catch { /* ignore */ }

      // Read from project store
      if (project?.clips) {
        setClips(project.clips);
      }
    }
    if (project) loadClips();
  }, [project, projectId]);

  function handleSelectClip(clip: Clip) {
    router.push(`/projects/${projectId}/editor?clipId=${clip.id}`);
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Project not found</p>
        <button
          onClick={() => router.push('/')}
          className="mt-4 text-primary hover:underline"
        >
          Back to home
        </button>
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
        <h1 className="text-2xl font-bold">{project.title}</h1>
        {project.channelName && (
          <p className="text-sm text-text-muted mt-1">{project.channelName}</p>
        )}
        <p className="text-xs text-text-muted mt-1 font-mono">{project.url}</p>
      </div>

      {/* Processing status if running */}
      {isRunning && <ProcessingStatus />}

      {/* Clip gallery */}
      <ClipGallery clips={clips} onSelectClip={handleSelectClip} />

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
