const FIREWORKS_URL = 'https://api.fireworks.ai/inference/v1/chat/completions';

/**
 * Generate catchy short-form titles using AI.
 */
export async function generateTitles(
  clipDescription: string,
  originalTitle: string,
  count: number = 5,
): Promise<string[]> {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) throw new Error('FIREWORKS_API_KEY not set');

  const res = await fetch(FIREWORKS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'accounts/fireworks/models/deepseek-v3p1',
      messages: [
        {
          role: 'system',
          content: `Generate ${count} catchy, hook-style titles for a YouTube Short clip. Titles should be:
- Under 60 characters
- Attention-grabbing and curiosity-inducing
- Suitable for YouTube Shorts

Return ONLY a JSON array of strings. Example: ["Title 1", "Title 2"]`,
        },
        {
          role: 'user',
          content: `Original video: "${originalTitle}"\nClip content: ${clipDescription}`,
        },
      ],
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) throw new Error(`Fireworks API error: ${res.status}`);

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '[]';
  const jsonStr = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
  return JSON.parse(jsonStr);
}
