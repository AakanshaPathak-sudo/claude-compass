import {
  buildConversationMessages,
  getGroqClient,
  initSSE,
  parseBody,
  streamModelText,
  writeSSE,
} from './_groq.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const { prompt, history, system } = body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  initSSE(res);

  try {
    const groq = getGroqClient();
    const conversationMessages = buildConversationMessages({ prompt, history });
    const systemPrompt =
      typeof system === 'string' && system.trim().length > 0
        ? system
        : 'Provide a direct and helpful answer to the user prompt.';

    await streamModelText({
      groq,
      system: systemPrompt,
      messages: conversationMessages,
      onChunk: (chunk) => writeSSE(res, { type: 'chunk', chunk }),
    });

    writeSSE(res, { type: 'done' });
    return res.end();
  } catch (error) {
    writeSSE(res, { type: 'error', message: error.message || 'Chat stream failed' });
    return res.end();
  }
}
