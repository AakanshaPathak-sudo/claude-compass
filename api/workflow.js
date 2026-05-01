import {
  buildConversationMessages,
  getGroqClient,
  initSSE,
  parseBody,
  streamModelText,
  writeSSE,
} from './_groq.js';

const applyCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

export default async function handler(req, res) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req);
  const { prompt, steps, history } = body;

  if (!prompt || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Prompt and steps are required' });
  }

  initSSE(res);

  try {
    const groq = getGroqClient();
    const conversationMessages = buildConversationMessages({ prompt, history });

    for (const step of steps) {
      writeSSE(res, { type: 'step_start', step });

      await streamModelText({
        groq,
        system: 'You execute one workflow step at a time. Return concise but useful output for the current step only.',
        messages: [
          ...conversationMessages,
          {
            role: 'user',
            content: `Run this step: ${step} for the following topic: ${prompt}. Use the same structure as before.`,
          },
        ],
        onChunk: (chunk) => writeSSE(res, { type: 'step_chunk', step, chunk }),
      });

      writeSSE(res, { type: 'step_end', step });
    }

    writeSSE(res, { type: 'done' });
    return res.end();
  } catch (error) {
    writeSSE(res, { type: 'error', message: error.message || 'Workflow stream failed' });
    return res.end();
  }
}
