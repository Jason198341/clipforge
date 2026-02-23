import { NextRequest, NextResponse } from 'next/server';
import { getProjectPaths, fileReady } from '@/lib/paths';
import { readFileSync, existsSync } from 'fs';
import type { Clip } from '@/types/project';

/** GET: Load clips for a project from filesystem */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  const paths = getProjectPaths(projectId);

  // Read analysis.json (contains clip array)
  if (!fileReady(paths.analysis)) {
    return NextResponse.json({ clips: [], metadata: null });
  }

  const clips: Clip[] = JSON.parse(readFileSync(paths.analysis, 'utf-8'));

  // Read metadata if available
  let metadata = null;
  if (fileReady(paths.metadata)) {
    metadata = JSON.parse(readFileSync(paths.metadata, 'utf-8'));
  }

  return NextResponse.json({ clips, metadata });
}
