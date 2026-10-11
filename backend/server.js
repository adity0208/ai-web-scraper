const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || true }));
app.use(express.json({ limit: '10mb' }));

// Route to handle URL summarization
app.post('/api/summarize', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format and allow only public HTTP(S) pages.
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol');
      if (['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) throw new Error('Local URLs are not allowed');
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Scrape the webpage
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      maxContentLength: 5 * 1024 * 1024,
      maxBodyLength: 5 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    // Load HTML into cheerio and extract text
    const $ = cheerio.load(html);

    // Prefer structured article text and semantic article containers over the
    // whole page, which often includes menus, recommendations, and comments.
    let text = '';
    const articleJsonLd = $('script[type="application/ld+json"]').toArray();
    for (const node of articleJsonLd) {
      try {
        const value = JSON.parse($(node).contents().text());
        const entries = Array.isArray(value) ? value : [value, ...(value['@graph'] || [])];
        const article = entries.find((entry) => /Article|BlogPosting|NewsArticle/.test(entry['@type'] || ''));
        if (article?.articleBody) {
          text = article.articleBody;
          break;
        }
      } catch { /* Ignore invalid JSON-LD and try the page's article markup. */ }
    }
    $('script, style, nav, header, footer, aside, noscript, iframe, form').remove();
    if (!text) {
      const candidates = $('article, main, [role="main"]').toArray();
      const best = candidates
        .map((node) => $(node).text())
        .sort((a, b) => b.length - a.length)[0];
      text = best || $('body').text();
    }
    text = text.replace(/\s+/g, ' ').trim();

    // Limit text length to avoid overwhelming the API
    if (text.length > 12000) {
      text = text.substring(0, 12000);
    }

    if (!text || text.length < 50) {
      return res.status(400).json({ error: 'Could not extract sufficient content from the webpage' });
    }

    // Generate summary using Gemini API
    const summary = await generateSummaryWithGemini(text);

    res.json({ summary });

  } catch (error) {
    console.error('Scrape/summarize error:', error.response?.status, error.message);

    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Request timeout. The webpage took too long to respond.' });
    }

    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'Webpage not found' });
    }

    if (error.response && error.response.status === 403) {
      return res.status(422).json({
        error: 'This site is refusing automated access (403). Try another public article or paste the article text into the summarizer.'
      });
    }

    if (error.message === 'Gemini API key not configured') {
      return res.status(500).json({ error: 'Add GEMINI_API_KEY to backend/.env and restart the backend.' });
    }

    res.status(500).json({ error: 'An error occurred while processing the URL' });
  }
});

// Function to generate summary using Gemini API
async function generateSummaryWithGemini(text) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;

  const prompt = `Analyze the following webpage text. Ignore boilerplate navigation, headers, and footer elements. 
Provide a deep, high-level summary capturing the absolute crux, core purpose, and primary takeaways of the content. 
CRITICAL LIMITATIONS: 
- Your entire response MUST be exactly 2-3 sentences.
- You MUST finish your final sentence completely. Do not leave trailing words.
- Do not summarize introductory lines or summarize sequentially; capture the main theme.
${text}`;

  const requestBody = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  try {
    const response = await axios.post(url, requestBody);

    if (response.data.candidates && response.data.candidates[0] &&
      response.data.candidates[0].content &&
      response.data.candidates[0].content.parts) {
      return response.data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error('Unexpected response format from Gemini API');
    }
  } catch (error) {
    console.error('Gemini API error:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate summary');
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

module.exports = app;
