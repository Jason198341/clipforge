'use client';

import type { Clip } from '@/types/project';
import ClipCard from './clip-card';

interface ClipGalleryProps {
  clips: Clip[];
  storyMode: boolean;
  onSelectClip?: (clip: Clip) => void;
  onComposeStory?: (clip: Clip) => void;
}

export default function ClipGallery({ clips, storyMode, onSelectClip, onComposeStory }: ClipGalleryProps) {
  if (clips.length === 0) return null;

  const sorted = [...clips].sort((a, b) => b.viralScore - a.viralScore);
  const totalDuration = clips.reduce((sum, c) => sum + (c.endSec - c.startSec), 0);
  const storyCount = clips.filter(c => c.storyPath).length;
  const metaCount = clips.filter(c => c.storyMeta).length;

  return (
    <div className="w-full mt-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">
          <span className="text-primary">{clips.length}</span> Clips Found
        </h2>
        <div className="flex items-center gap-4 text-sm text-text-muted">
          <span>Total: {Math.round(totalDuration)}s</span>
          <span>Avg score: {(clips.reduce((s, c) => s + c.viralScore, 0) / clips.length).toFixed(1)}</span>
          {storyMode && metaCount > 0 && (
            <span className="text-amber-400">
              {storyCount}/{metaCount} stories
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((clip, i) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={i}
            storyMode={storyMode}
            onSelect={onSelectClip}
            onComposeStory={onComposeStory}
          />
        ))}
      </div>
    </div>
  );
}
