import React, { useState } from 'react';

function App() {
  const apiBaseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setLoading(true);
    setError('');
    setSummary('');

    try {
      const response = await fetch(`${apiBaseUrl}/api/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to summarize');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Web Scraper & Summarizer</h1>
        <p>Enter a URL to scrape and get an AI-powered summary</p>
      </header>

      <main>
        <form onSubmit={handleSubmit} className="url-form">
          <div>
            <label htmlFor="url-input">Website URL:</label>
            <input
              type="url"
              id="url-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Summarizing...' : 'Summarize'}
          </button>
        </form>

        {error && <div className="error">{error}</div>}

        {summary && (
          <div className="summary">
            <h2>Summary:</h2>
            <p>{summary}</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
