import fs from 'fs';
import path from 'path';
import { ensureDataDir, generateId, DATA_DIR } from './storage.js';

const LINKS_PATH = path.join(DATA_DIR, 'links.json');

function loadLinks() {
  ensureDataDir();
  if (!fs.existsSync(LINKS_PATH)) {
    return { categories: [] };
  }
  try {
    const raw = fs.readFileSync(LINKS_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data?.categories) ? data : { categories: [] };
  } catch (err) {
    console.error('Failed to load links:', err);
    return { categories: [] };
  }
}

function saveLinks(data) {
  ensureDataDir();
  const normalized = {
    categories: (data.categories || []).map((c) => ({
      id: c.id || generateId(),
      name: String(c.name || '').trim(),
      links: (c.links || []).map((l) => ({
        id: l.id || generateId(),
        url: String(l.url || '').trim(),
        displayName: String(l.displayName || l.url || '').trim(),
      })),
    })),
  };
  fs.writeFileSync(LINKS_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export function getLinks() {
  return loadLinks();
}

export function saveLinksData(data) {
  const names = (data.categories || []).map((c) => String(c.name || '').trim().toLowerCase());
  const seen = new Set();
  for (const n of names) {
    if (n && seen.has(n)) {
      throw new Error('Category names must be unique');
    }
    if (n) seen.add(n);
  }
  return saveLinks(data);
}
