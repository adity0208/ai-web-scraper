# AI Web Scraper & Summarizer

Paste a public article URL to extract its main text and get a short AI summary. The app uses React/Vite, Express, Cheerio, and Gemini. Pages that block automated requests or require sign-in may not work.

## Run locally

Requirements: Node.js 22 and a Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).

1. In `backend`, create `.env` with:

   ```env
   PORT=5000
   GEMINI_API_KEY=your_key_here
   ```

2. In `frontend`, create `.env` with:

   ```env
   VITE_API_URL=http://localhost:5000
   ```

3. Open two terminals. In `backend`, run `npm install` and `npm start`. In `frontend`, run `npm install` and `npm run dev`.
4. Open the local URL printed by Vite.

Never commit `.env` files or publish your API key.

## Deploy

i pushed this repository to GitHub, then create two services from it:

- **Render backend:** New > Web Service; root directory `backend`; build command `npm install`; start command `npm start`. Add `GEMINI_API_KEY` and `FRONTEND_URL` (your Vercel site URL) under Environment.
- **Vercel frontend:** Add New Project and import the same repo; set root directory to `frontend`. Add `VITE_API_URL` with your Render service URL (for example, `https://your-service.onrender.com`), then deploy.

After both deploy, I confirm the Vercel URL is set as Render's `FRONTEND_URL` and Redeploy the frontend after changing its environment variables.
