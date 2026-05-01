import {
  buildConversationMessages,
  CLASSIFIER_SYSTEM_PROMPT,
  getGroqClient,
  MODEL,
  parseBody,
  parseClassifierJSON,
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

  try {
    const body = await parseBody(req);
    const { prompt, history } = body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const groq = getGroqClient();
    const conversationMessages = buildConversationMessages({ prompt, history });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      temperature: 0,
      messages: [{ role: 'system', content: CLASSIFIER_SYSTEM_PROMPT }, ...conversationMessages],
    });

    const text = completion.choices?.[0]?.message?.content ?? '';
    const classification = parseClassifierJSON(text);
    return res.status(200).json({ classification });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Classification request failed' });
  }
}
