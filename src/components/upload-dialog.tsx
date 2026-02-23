'use client';

import { useState } from 'react';
import type { Clip } from '@/types/project';

interface UploadDialogProps {
  clip: Clip;
  projectId: string;
  onClose: () => void;
}

export default function UploadDialog({ clip, projectId, onClose }: UploadDialogProps) {
  const [title, setTitle] = useState(clip.title);
  const [description, setDescription] = useState(clip.description);
  const [tags, setTags] = useState(clip.tags.join(', '));
  const [privacy, setPrivacy] = useState<'private' | 'unlisted' | 'public'>('private');
  const [hookText, setHookText] = useState('');
  const [isHooking, setIsHooking] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<{ videoId: string; url: string } | null>(null);
  const [error, setError] = useState('');

  async function handleHook() {
    if (!hookText.trim()) return;
    setIsHooking(true);
    setError('');
    try {
      const res = await fetch('/api/hooking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, clipId: clip.id, hookText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Hook generation failed');
    } finally {
      setIsHooking(false);
    }
  }

  async function handleUpload() {
    setIsUploading(true);
    setError('');
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          clipId: clip.id,
          title,
          description,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          privacyStatus: privacy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({ videoId: data.videoId, url: data.youtubeUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">Upload to YouTube</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            &times;
          </button>
        </div>

        {result ? (
          <div className="text-center py-8">
            <div className="text-success text-4xl mb-4">&#10003;</div>
            <p className="font-medium mb-2">Upload Complete!</p>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm"
            >
              {result.url}
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {/* Privacy */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Privacy</label>
              <select
                value={privacy}
                onChange={e => setPrivacy(e.target.value as 'private' | 'unlisted' | 'public')}
                className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                <option value="private">Private</option>
                <option value="unlisted">Unlisted</option>
                <option value="public">Public</option>
              </select>
            </div>

            {/* Hook TTS */}
            <div className="border-t border-border pt-4">
              <label className="text-xs text-text-muted block mb-1">Hook Voiceover (optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={hookText}
                  onChange={e => setHookText(e.target.value)}
                  placeholder="e.g. Wait till you hear this..."
                  className="flex-1 px-3 py-2 bg-bg border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleHook}
                  disabled={isHooking || !hookText.trim()}
                  className="px-4 py-2 bg-accent-dim text-accent rounded-lg text-sm hover:bg-accent/20 disabled:opacity-40"
                >
                  {isHooking ? '...' : 'Generate'}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-danger text-sm">{error}</p>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={isUploading || !title.trim()}
              className="w-full py-3 bg-danger hover:bg-danger/80 text-white font-semibold rounded-lg transition-colors disabled:opacity-40"
            >
              {isUploading ? 'Uploading...' : 'Upload to YouTube'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
