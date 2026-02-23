'use client';

import { useState } from 'react';

interface TitleEditorProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (desc: string) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export default function TitleEditor({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onRegenerate,
  isRegenerating,
}: TitleEditorProps) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-muted">Title & Description</h3>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3 py-1 text-xs bg-primary-dim text-primary rounded hover:bg-primary/20 transition-colors disabled:opacity-40"
          >
            {isRegenerating ? 'Generating...' : 'AI Regenerate'}
          </button>
        )}
      </div>

      <input
        type="text"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
        placeholder="Clip title..."
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm font-medium focus:outline-none focus:border-primary"
      />

      <textarea
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Description..."
        rows={2}
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
      />
    </div>
  );
}
