import type { SSEMessage } from '@/types/pipeline';

/**
 * Create an SSE-compatible ReadableStream for Next.js route handlers.
 * Usage in API route:
 *   const { stream, send, close } = createSSEStream();
 *   // ... async work ...
 *   send({ type: 'progress', progress: 50, message: 'Half done' });
 *   close();
 *   return new Response(stream, { headers: sseHeaders() });
 */
export function createSSEStream() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      controller = null;
    },
  });

  function send(msg: SSEMessage) {
    if (!controller) return;
    try {
      const data = `data: ${JSON.stringify(msg)}\n\n`;
      controller.enqueue(encoder.encode(data));
    } catch {
      // Stream closed
    }
  }

  function close() {
    if (!controller) return;
    try {
      controller.close();
    } catch {
      // Already closed
    }
    controller = null;
  }

  return { stream, send, close };
}

/** Standard SSE response headers */
export function sseHeaders(): HeadersInit {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  };
}
