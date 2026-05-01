import Groq from 'groq-sdk';

export const MODEL = 'llama-3.3-70b-versatile';

export const CLASSIFIER_SYSTEM_PROMPT =
  "You are an intent classifier. Analyse the user's prompt and return JSON only with these fields: recommendation (one of: workflow, simple_prompt, agent, skill), reason (one sentence explaining why), steps (array of 3-6 step names if workflow, else empty), tokens_min (integer), tokens_max (integer), time_estimate (string like '3-6 min' or '~15 sec'), quality (string), repeatable (boolean). Return only valid JSON, no other text.";

export const getGroqClient = () => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing');
  }

  return new Groq({ apiKey });
};

export const parseBody = async (req) => {
  if (req?.body) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    return req.body;
  }

  if (!req || typeof req.on !== 'function') {
    return {};
  }

  const raw = await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

export const parseClassifierJSON = (rawText) => {
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('No JSON object found in classifier output');
    }
    return JSON.parse(match[0]);
  }
};

export const buildConversationMessages = ({ prompt, history }) => {
  const normalizedHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && (entry.role === 'user' || entry.role === 'assistant'))
        .map((entry) => ({
          role: entry.role,
          content: typeof entry.content === 'string' ? entry.content : '',
        }))
        .filter((entry) => entry.content.trim().length > 0)
    : [];

  if (normalizedHistory.length > 0) {
    return normalizedHistory;
  }

  if (typeof prompt === 'string' && prompt.trim().length > 0) {
    return [{ role: 'user', content: prompt.trim() }];
  }

  return [];
};

export const initSSE = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
};

export const writeSSE = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

export const streamModelText = async ({ groq, system, messages, onChunk }) => {
  const stream = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    stream: true,
    messages: [{ role: 'system', content: system }, ...messages],
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content ?? '';
    if (text) {
      onChunk(text);
    }
  }
};
