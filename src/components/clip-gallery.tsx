'use client';

import type { Clip } from '@/types/project';
import ClipCard from './clip-card';

interface ClipGalleryProps {
  clips: Clip[];
  onSelectClip?: (clip: Clip) => void;
}

export default function ClipGallery({ clips, onSelectClip }: ClipGalleryProps) {
  if (clips.length === 0) return null;

  const sorted = [...clips].sort((a, b) => b.viralScore - a.viralScore);
  const totalDuration = clips.reduce((sum, c) => sum + (c.endSec - c.startSec), 0);

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
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((clip, i) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            index={i}
            onSelect={onSelectClip}
          />
        ))}
      </div>
    </div>
  );
}
