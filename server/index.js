import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('GROQ_API_KEY is missing. API calls will fail until set in .env');
}

const groq = new Groq({
  apiKey,
});
const MODEL = 'llama-3.3-70b-versatile';

const CLASSIFIER_SYSTEM_PROMPT = `You are an intent classifier. Analyse the user's prompt and return JSON only with these fields: recommendation (one of: workflow, simple_prompt, agent, skill), reason (one sentence explaining why), steps (array of 3-6 step names if workflow, else empty), tokens_min (integer), tokens_max (integer), time_estimate (string like '3-6 min' or '~15 sec'), quality (string), repeatable (boolean). Return only valid JSON, no other text.`;

const writeSSE = (res, payload) => {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

const parseClassifierJSON = (rawText) => {
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

const buildConversationMessages = ({ prompt, history }) => {
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

const streamModelText = async ({ system, messages, onChunk }) => {
  const stream = await groq.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.2,
    stream: true,
    messages: [
      { role: 'system', content: system },
      ...messages,
    ],
  });

  for await (const chunk of stream) {
    const text = chunk.choices?.[0]?.delta?.content ?? '';
    if (text) {
      onChunk(text);
    }
  }
};

app.post('/api/classify', async (req, res) => {
  try {
    const { prompt, history } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const conversationMessages = buildConversationMessages({ prompt, history });

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 300,
      temperature: 0,
      messages: [
        { role: 'system', content: CLASSIFIER_SYSTEM_PROMPT },
        ...conversationMessages,
      ],
    });

    const text = completion.choices?.[0]?.message?.content ?? '';

    const classification = parseClassifierJSON(text);
    return res.json({ classification });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Classification request failed' });
  }
});

const workflowHandler = async (req, res) => {
  const { prompt, steps, history } = req.body;

  if (!prompt || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Prompt and steps are required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const conversationMessages = buildConversationMessages({ prompt, history });
    const workflowPrompt = [
      `Topic: ${prompt}`,
      '',
      'Execute these workflow steps in order and return JSON only:',
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      '',
      'Return strictly valid JSON in this shape:',
      '{ "steps": [ { "name": "step name", "output": "concise result" } ] }',
      'Keep each output concise but useful. Do not include markdown fences or extra text.',
    ].join('\n');

    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: 1400,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You execute a multi-step workflow in a single pass. Return only valid JSON with one concise output per provided step.',
        },
        ...conversationMessages,
        { role: 'user', content: workflowPrompt },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content ?? '';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      parsed = match ? JSON.parse(match[0]) : null;
    }

    const parsedSteps = Array.isArray(parsed?.steps) ? parsed.steps : [];

    for (let index = 0; index < steps.length; index += 1) {
      const stepName = steps[index];
      const resolvedStep = parsedSteps.find((item) => item?.name === stepName) || parsedSteps[index];
      const output = typeof resolvedStep?.output === 'string' ? resolvedStep.output : '';

      writeSSE(res, { type: 'step_start', step: stepName });
      if (output.trim().length > 0) {
        writeSSE(res, { type: 'step_chunk', step: stepName, chunk: output });
      }
      writeSSE(res, { type: 'step_end', step: stepName });
    }

    writeSSE(res, { type: 'done' });
    return res.end();
  } catch (error) {
    writeSSE(res, { type: 'error', message: error.message || 'Workflow stream failed' });
    return res.end();
  }
};

app.post('/api/workflow', workflowHandler);
app.post('/api/workflow/stream', workflowHandler);

const chatHandler = async (req, res) => {
  const { prompt, history, system } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const conversationMessages = buildConversationMessages({ prompt, history });
    const systemPrompt =
      typeof system === 'string' && system.trim().length > 0
        ? system
        : 'Provide a direct and helpful answer to the user prompt.';

    await streamModelText({
      system: systemPrompt,
      messages: conversationMessages,
      onChunk: (chunk) => writeSSE(res, { type: 'chunk', chunk }),
    });

    writeSSE(res, { type: 'done' });
    return res.end();
  } catch (error) {
    writeSSE(res, { type: 'error', message: error.message || 'Simple stream failed' });
    return res.end();
  }
};

app.post('/api/chat', chatHandler);
app.post('/api/simple/stream', chatHandler);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Claude Compass API listening on http://localhost:${port}`);
});
