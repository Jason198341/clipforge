'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useEditorStore } from '@/stores/editorStore';
import { useProjectStore } from '@/stores/projectStore';
import TimelineEditor from '@/components/timeline-editor';
import CaptionEditor from '@/components/caption-editor';
import TitleEditor from '@/components/title-editor';
import TemplatePicker from '@/components/template-picker';
import VideoPreview from '@/components/video-preview';
import UploadDialog from '@/components/upload-dialog';

export default function EditorPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = params.id as string;
  const clipId = searchParams.get('clipId');

  const { projects, loadFromStorage, updateClip } = useProjectStore();
  const editor = useEditorStore();
  const [isRendering, setIsRendering] = useState(false);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const project = projects.find(p => p.id === projectId);
  const clip = project?.clips.find(c => c.id === clipId);

  useEffect(() => {
    if (project && clip && (!editor.clip || editor.clip.id !== clip.id)) {
      editor.loadClip(projectId, clip);
    }
  }, [project, clip, projectId, editor]);

  async function handleSaveAndRender() {
    const updated = editor.getUpdatedClip();
    if (!updated) return;

    // Save to project store
    updateClip(projectId, updated.id, updated);

    // Trigger re-render
    setIsRendering(true);
    try {
      await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          clipId: updated.id,
          templateId: updated.templateId,
        }),
      });
      updateClip(projectId, updated.id, { status: 'rendered' });
    } catch (err) {
      console.error('Render failed:', err);
    } finally {
      setIsRendering(false);
    }
  }

  async function handleRegenerateTitles() {
    if (!clip) return;
    setIsGeneratingTitles(true);
    try {
      const res = await fetch('/api/titles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clipDescription: clip.description,
          originalTitle: project?.title,
        }),
      });
      const data = await res.json();
      if (data.titles?.[0]) {
        editor.setTitle(data.titles[0]);
      }
    } catch (err) {
      console.error('Title generation failed:', err);
    } finally {
      setIsGeneratingTitles(false);
    }
  }

  if (!project || !clip) {
    return (
      <div className="text-center py-20">
        <p className="text-text-muted">Clip not found</p>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="mt-4 text-primary hover:underline"
        >
          Back to project
        </button>
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => router.push(`/projects/${projectId}`)}
        className="text-sm text-text-muted hover:text-primary mb-6 inline-block"
      >
        &larr; Back to clips
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Preview */}
        <div>
          <VideoPreview
            projectId={projectId}
            clipId={clip.id}
            type={clip.status === 'rendered' ? 'rendered' : 'source'}
          />
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs ${
              clip.status === 'rendered' ? 'bg-success/10 text-success' : 'bg-primary-dim text-primary'
            }`}>
              {clip.status}
            </span>
            <span className="text-xs text-text-muted">
              Score: <span className="text-accent font-bold">{clip.viralScore}/10</span>
            </span>
          </div>
        </div>

        {/* Right: Editor controls */}
        <div className="space-y-6">
          <TitleEditor
            title={editor.title}
            description={editor.description}
            onTitleChange={editor.setTitle}
            onDescriptionChange={editor.setDescription}
            onRegenerate={handleRegenerateTitles}
            isRegenerating={isGeneratingTitles}
          />

          <TimelineEditor
            startSec={editor.startSec}
            endSec={editor.endSec}
            totalDuration={project.duration || editor.endSec + 30}
            onChange={editor.setTimeRange}
          />

          <TemplatePicker
            selectedId={editor.templateId}
            onSelect={(t) => editor.setTemplateId(t.id)}
          />

          <CaptionEditor
            captions={editor.captions}
            onChange={editor.updateCaption}
          />

          {/* Action buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={handleSaveAndRender}
              disabled={isRendering}
              className="flex-1 py-3 bg-primary hover:bg-primary-hover text-bg font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              {isRendering ? 'Rendering...' : 'Save & Render'}
            </button>
            <button
              onClick={() => setShowUpload(true)}
              disabled={clip.status !== 'rendered'}
              className="px-6 py-3 bg-danger/80 hover:bg-danger text-white font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              Upload
            </button>
          </div>
        </div>
      </div>

      {/* Upload dialog */}
      {showUpload && clip && (
        <UploadDialog
          clip={clip}
          projectId={projectId}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}
