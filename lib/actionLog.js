import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const ACTION_LOG_PATH = path.join(DATA_DIR, 'action-log.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLog() {
  ensureDataDir();
  if (!fs.existsSync(ACTION_LOG_PATH)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(ACTION_LOG_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Failed to load action log:', err);
    return [];
  }
}

function saveLog(entries) {
  ensureDataDir();
  fs.writeFileSync(ACTION_LOG_PATH, JSON.stringify(entries, null, 2), 'utf8');
}

export function getActionLog() {
  return loadLog();
}

export function appendToActionLog(timestamp, message) {
  const entries = loadLog();
  entries.push({ timestamp, message });
  saveLog(entries);
}
