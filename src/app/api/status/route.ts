import { NextRequest } from 'next/server';
import { createSSEStream, sseHeaders } from '@/lib/sse';
import { runPipeline } from '@/lib/pipeline';
import type { SSEMessage } from '@/types/pipeline';

// Store active pipelines so SSE GET can tap into progress
const activePipelines = new Map<string, {
  send: (msg: SSEMessage) => void;
  close: () => void;
  connId: string;
}>();

/** GET: SSE stream for pipeline progress */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId');
  if (!projectId) {
    return new Response('projectId required', { status: 400 });
  }

  const { stream, send, close } = createSSEStream();
  const connId = Math.random().toString(36).slice(2);

  // Register this SSE connection (replaces old one on reconnect)
  activePipelines.set(projectId, { send, close, connId });

  // Send keepalive every 15s to prevent browser/proxy timeout
  const keepalive = setInterval(() => {
    send({ type: 'progress', message: '' } as SSEMessage);
  }, 15000);

  // Clean up on disconnect — only delete if this is still the active connection
  req.signal.addEventListener('abort', () => {
    clearInterval(keepalive);
    const current = activePipelines.get(projectId);
    if (current?.connId === connId) {
      activePipelines.delete(projectId);
    }
    close();
  });

  return new Response(stream, { headers: sseHeaders() });
}

/** POST: Start the pipeline */
export async function POST(req: NextRequest) {
  try {
    const { projectId, url } = await req.json();

    if (!projectId || !url) {
      return new Response(JSON.stringify({ error: 'projectId and url required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Run pipeline in background (don't await)
    runPipeline(projectId, url, (msg) => {
      const connection = activePipelines.get(projectId);
      if (connection) connection.send(msg);
    }).then(() => {
      const connection = activePipelines.get(projectId);
      if (connection) {
        connection.send({ type: 'done', message: 'Pipeline complete' });
        connection.close();
        activePipelines.delete(projectId);
      }
    }).catch((err) => {
      const connection = activePipelines.get(projectId);
      if (connection) {
        connection.send({ type: 'error', error: err.message });
        connection.close();
        activePipelines.delete(projectId);
      }
    });

    return new Response(JSON.stringify({ started: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start pipeline';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
