'use client';

import { useState } from 'react';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  disabled?: boolean;
}

export default function UrlInput({ onSubmit, disabled }: UrlInputProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please enter a YouTube URL');
      return;
    }

    try {
      const u = new URL(trimmed);
      const validHosts = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'];
      if (!validHosts.includes(u.hostname)) {
        setError('Please enter a valid YouTube URL');
        return;
      }
    } catch {
      setError('Invalid URL format');
      return;
    }

    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError(''); }}
          placeholder="Paste YouTube URL here..."
          disabled={disabled}
          className="w-full px-5 py-4 bg-surface border border-border rounded-xl text-text placeholder:text-text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors text-lg disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || !url.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-primary hover:bg-primary-hover text-bg font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {disabled ? 'Processing...' : 'Forge'}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-danger text-sm">{error}</p>
      )}
    </form>
  );
}
