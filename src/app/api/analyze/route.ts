import { NextRequest, NextResponse } from 'next/server';
import { analyzeHighlights } from '@/lib/ai-analyze';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { readFileSync, writeFileSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { projectId } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    if (!fileReady(paths.transcript)) {
      return NextResponse.json({ error: 'Transcript not found. Transcribe first.' }, { status: 400 });
    }

    const transcription = JSON.parse(readFileSync(paths.transcript, 'utf-8'));
    const metadata = fileReady(paths.metadata)
      ? JSON.parse(readFileSync(paths.metadata, 'utf-8'))
      : { title: 'Unknown', duration: 0 };

    const clips = await analyzeHighlights(
      transcription,
      metadata.title,
      metadata.duration,
      projectId,
    );

    writeFileSync(paths.analysis, JSON.stringify(clips, null, 2));

    return NextResponse.json({
      success: true,
      clipCount: clips.length,
      clips,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
