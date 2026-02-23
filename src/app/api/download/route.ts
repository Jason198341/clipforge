import { NextRequest, NextResponse } from 'next/server';
import { downloadVideo, readMetadata, isValidYouTubeUrl } from '@/lib/ytdlp';
import { getProjectPaths } from '@/lib/paths';

export async function POST(req: NextRequest) {
  try {
    const { url, projectId } = await req.json();

    if (!url || !projectId) {
      return NextResponse.json({ error: 'url and projectId required' }, { status: 400 });
    }

    if (!isValidYouTubeUrl(url)) {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    await downloadVideo(url, paths.source);

    const metadata = readMetadata(paths.root);

    // Write metadata to file for later use
    const { writeFileSync } = require('fs');
    writeFileSync(paths.metadata, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      success: true,
      metadata,
      sourcePath: paths.source,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Download failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
