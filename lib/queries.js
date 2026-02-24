import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const QUERIES_PATH = path.join(DATA_DIR, 'saved-queries.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadQueries() {
  ensureDataDir();
  if (!fs.existsSync(QUERIES_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(QUERIES_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to load saved queries:', err);
    return [];
  }
}

function saveQueries(queries) {
  ensureDataDir();
  fs.writeFileSync(QUERIES_PATH, JSON.stringify(queries, null, 2), 'utf8');
}

export function getSavedQueries() {
  return loadQueries();
}

export function addSavedQuery(name, clauses) {
  const queries = loadQueries();
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  queries.push({ id, name, clauses });
  saveQueries(queries);
  return { id, name, clauses };
}
