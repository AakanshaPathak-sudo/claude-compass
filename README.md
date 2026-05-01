# Claude Compass

A minimal React + Tailwind app with real Groq SDK integration that classifies user intent, previews execution tradeoffs, and supports streamed responses for both workflow and simple prompt paths.

## Setup

1. Install dependencies:
   - `npm install`
2. Add your Groq API key in `.env`:
   - `GROQ_API_KEY=your_key_here`
3. Run both frontend and API server locally:
   - `npm run dev`

The Vite app runs on `http://localhost:5173` and proxies API calls to the Express server on `http://localhost:8787`.

## Vercel deployment

- API routes are implemented as Vercel serverless functions in `api/`:
  - `POST /api/classify`
  - `POST /api/chat`
  - `POST /api/workflow`
- Set `GROQ_API_KEY` in Vercel Project Environment Variables.
- The frontend only calls local relative `/api/*` endpoints; Groq is called server-side via `process.env.GROQ_API_KEY`.

## Implemented behavior

- Chat input at the bottom sends the user prompt.
- First API call classifies intent using the exact system prompt requested.
- Compass panel appears with slide-up animation and loading spinner while classifying.
- On classification success, Screen 1 shows recommendation + reason.
- Clicking the recommendation button reveals Screen 2 with token/time/quality/repeatability tradeoff data via accordion-style expansion.
- Confirming `Use workflow` streams each workflow step output into the panel sequentially.
- Confirming `Use simple prompt` streams Claude output directly into chat.
- All model calls use `llama-3.3-70b-versatile` via Groq.
