import { getGroqClient, MODEL, parseBody } from './_groq.js';

const applyCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

const QUALITY_SYSTEM_PROMPT =
  "You are a prompt quality checker. Evaluate if this prompt is specific enough to produce a high quality structured output. Return JSON only: {isVague: boolean, missingInfo: string[]} where missingInfo is a list of 2-3 specific things that would make the prompt better. Example missing info: 'time period', 'specific states to focus on', 'type of data needed', 'format of output'.";

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
    const { prompt } = body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 250,
      temperature: 0,
      messages: [
        { role: 'system', content: QUALITY_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
    });

    const text = completion.choices?.[0]?.message?.content ?? '';
    let quality;
    try {
      quality = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      quality = match ? JSON.parse(match[0]) : {};
    }

    const payload = {
      isVague: Boolean(quality?.isVague),
      missingInfo: Array.isArray(quality?.missingInfo)
        ? quality.missingInfo.filter((item) => typeof item === 'string').slice(0, 3)
        : [],
    };

    return res.status(200).json({ quality: payload });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Prompt quality check failed' });
  }
}
