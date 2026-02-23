import { NextRequest, NextResponse } from 'next/server';
import { uploadToYouTube, buildDescription } from '@/lib/youtube-upload';
import { getProjectPaths } from '@/lib/paths';
import { existsSync } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { projectId, clipId, title, description, tags, privacyStatus } = await req.json();

    if (!projectId || !clipId) {
      return NextResponse.json({ error: 'projectId and clipId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    // Try hooked version first, then rendered, then raw
    const candidates = [
      path.join(paths.renderedDir, `${clipId}_hooked.mp4`),
      path.join(paths.renderedDir, `${clipId}_rendered.mp4`),
      path.join(paths.clipsDir, `${clipId}.mp4`),
    ];

    const videoPath = candidates.find(c => existsSync(c));
    if (!videoPath) {
      return NextResponse.json({ error: 'No video file found for this clip' }, { status: 404 });
    }

    const desc = description || buildDescription(title || 'Untitled', tags || []);

    const videoId = await uploadToYouTube(videoPath, {
      title: title || 'Untitled Short',
      description: desc,
      tags: tags || [],
      privacyStatus: privacyStatus || 'private',
    });

    return NextResponse.json({
      success: true,
      videoId,
      youtubeUrl: `https://youtube.com/shorts/${videoId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
