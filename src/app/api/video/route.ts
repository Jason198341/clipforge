import { NextRequest } from 'next/server';
import { getProjectPaths } from '@/lib/paths';
import { existsSync, readFileSync, statSync } from 'fs';
import path from 'path';

/** Serve video files from workspace */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  const clipId = req.nextUrl.searchParams.get('clipId');
  const type = req.nextUrl.searchParams.get('type') || 'rendered';

  if (!projectId || !clipId) {
    return new Response('Missing projectId or clipId', { status: 400 });
  }

  const paths = getProjectPaths(projectId);
  let filePath: string;

  if (type === 'rendered') {
    filePath = path.join(paths.renderedDir, `${clipId}_rendered.mp4`);
  } else {
    filePath = path.join(paths.clipsDir, `${clipId}.mp4`);
  }

  if (!existsSync(filePath)) {
    return new Response('Video not found', { status: 404 });
  }

  const stat = statSync(filePath);
  const range = req.headers.get('range');

  if (range) {
    // Range request for video seeking
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunksize = end - start + 1;

    const { createReadStream } = require('fs');
    const stream = createReadStream(filePath, { start, end });

    // Convert Node stream to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)));
        stream.on('end', () => controller.close());
        stream.on('error', (err: Error) => controller.error(err));
      },
    });

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize.toString(),
        'Content-Type': 'video/mp4',
      },
    });
  }

  // Full file response
  const buffer = readFileSync(filePath);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size.toString(),
      'Accept-Ranges': 'bytes',
    },
  });
}
