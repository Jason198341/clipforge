import { NextRequest, NextResponse } from 'next/server';
import { extractAudio } from '@/lib/ffmpeg';
import { transcribe } from '@/lib/whisper';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { writeFileSync } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { projectId, model, language } = await req.json();

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    const paths = getProjectPaths(projectId);

    if (!fileReady(paths.source)) {
      return NextResponse.json({ error: 'Source video not found. Download first.' }, { status: 400 });
    }

    // Step 1: Extract audio (16kHz mono WAV for Whisper)
    if (!fileReady(paths.audio)) {
      await extractAudio(paths.source, paths.audio);
    }

    // Step 2: Transcribe
    const transcription = await transcribe(paths.audio, paths.root, {
      model: model || 'base',
      language: language || 'auto',
    });

    // Save transcript
    writeFileSync(paths.transcript, JSON.stringify(transcription, null, 2));

    return NextResponse.json({
      success: true,
      transcription,
      segmentCount: transcription.segments.length,
      language: transcription.language,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
