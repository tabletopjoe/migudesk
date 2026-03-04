import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { getAuthClient, getAuthUrl, exchangeCodeForToken, TOKEN_PATH } from './lib/auth.js';
import { searchMessages, trashMessages } from './lib/gmail.js';
import { getSavedQueries, addSavedQuery } from './lib/queries.js';
import { getActionLog, appendToActionLog } from './lib/actionLog.js';
import { getAccountData } from './lib/account.js';
import { getLinks, saveLinksData } from './lib/links.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Session info (IP, etc.) - for home metadata
app.get('/api/session-info', (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || '—';
  res.json({ ip });
});

// Auth status
app.get('/auth/status', (req, res) => {
  const auth = getAuthClient();
  res.json({ authenticated: !!auth });
});

// Get auth URL for login
app.get('/auth/url', (req, res) => {
  try {
    const { authUrl } = getAuthUrl();
    res.json({ url: authUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get auth URL' });
  }
});

// Logout (delete stored token)
app.post('/auth/logout', (req, res) => {
  try {
    if (fs.existsSync(TOKEN_PATH)) {
      fs.unlinkSync(TOKEN_PATH);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// OAuth callback (must match redirect_uris in credentials.json, e.g. /oauth2callback)
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.redirect('/?error=missing_code');
  }
  try {
    await exchangeCodeForToken(code);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.redirect('/?error=auth_failed');
  }
});

// Search messages
app.post('/api/search', async (req, res) => {
  const auth = getAuthClient();
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { query, pageToken, maxResults } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'query is required' });
  }
  try {
    const result = await searchMessages(auth, query.trim(), pageToken, maxResults);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// Saved links
app.get('/api/links', (_req, res) => {
  try {
    const data = getLinks();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/links', (req, res) => {
  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    return res.status(400).json({ error: 'categories array is required' });
  }
  try {
    const saved = saveLinksData({ categories });
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// Saved queries
app.get('/api/saved-queries', (_req, res) => {
  try {
    const queries = getSavedQueries();
    res.json(queries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/saved-queries', (req, res) => {
  const { name, clauses } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!Array.isArray(clauses)) {
    return res.status(400).json({ error: 'clauses array is required' });
  }
  try {
    const saved = addSavedQuery(name.trim(), clauses);
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Account data (profile + storage)
app.get('/api/account-data', async (_req, res) => {
  const auth = getAuthClient();
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const data = await getAccountData(auth);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to get account data' });
  }
});

// Action log
app.get('/api/action-log', (_req, res) => {
  try {
    const entries = getActionLog();
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/action-log', (req, res) => {
  const { timestamp, message } = req.body;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  try {
    appendToActionLog(timestamp, message);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Trash messages
app.post('/api/trash', async (req, res) => {
  const auth = getAuthClient();
  if (!auth) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const { messageIds } = req.body;
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: 'messageIds array is required' });
  }
  try {
    const result = await trashMessages(auth, messageIds);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Trash failed' });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`megaDesk running at http://localhost:${PORT}`);
});
