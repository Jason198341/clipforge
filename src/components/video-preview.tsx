'use client';

interface VideoPreviewProps {
  projectId: string;
  clipId: string;
  type: 'source' | 'rendered';
}

export default function VideoPreview({ projectId, clipId, type }: VideoPreviewProps) {
  const videoSrc = `/api/video?projectId=${projectId}&clipId=${clipId}&type=${type}`;

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '9/16' }}>
        <video
          src={videoSrc}
          controls
          className="w-full h-full object-contain"
          playsInline
        >
          Your browser does not support the video element.
        </video>
      </div>
    </div>
  );
}
