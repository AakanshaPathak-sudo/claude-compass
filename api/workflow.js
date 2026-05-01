import { buildConversationMessages, getGroqClient, initSSE, parseBody, MODEL, writeSSE } from './_groq.js';

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

  const body = await parseBody(req);
  const { prompt, steps, history } = body;

  if (!prompt || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'Prompt and steps are required' });
  }

  initSSE(res);

  try {
    const groq = getGroqClient();
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
}
