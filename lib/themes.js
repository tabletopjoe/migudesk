import fs from 'fs';
import path from 'path';
import { ensureDataDir, generateId, DATA_DIR } from './storage.js';

const THEMES_PATH = path.join(DATA_DIR, 'themes.json');

function clamp255(n) {
  return Math.min(255, Math.max(0, parseInt(n, 10) || 0));
}

function normalizeRgba(obj) {
  return {
    r: clamp255(obj?.r ?? 128),
    g: clamp255(obj?.g ?? 128),
    b: clamp255(obj?.b ?? 128),
    a: clamp255(obj?.a ?? 255),
  };
}

function loadThemes() {
  ensureDataDir();
  if (!fs.existsSync(THEMES_PATH)) {
    return { themes: [] };
  }
  try {
    const raw = fs.readFileSync(THEMES_PATH, 'utf8');
    const data = JSON.parse(raw);
    const themes = Array.isArray(data?.themes) ? data.themes : [];
    return {
      themes: themes.map((t) => ({
        id: t.id || generateId(),
        name: String(t.name || '').trim(),
        slots: (t.slots || []).map((s) => normalizeRgba(s)),
        bg: normalizeRgba(t.bg),
      })),
    };
  } catch (err) {
    console.error('Failed to load themes:', err);
    return { themes: [] };
  }
}

function saveThemes(data) {
  ensureDataDir();
  const themes = (data.themes || []).map((t) => ({
    id: t.id || generateId(),
    name: String(t.name || '').trim(),
    slots: (t.slots || []).map((s) => normalizeRgba(s)),
    bg: normalizeRgba(t.bg),
  }));
  const normalized = { themes };
  fs.writeFileSync(THEMES_PATH, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

export function getThemes() {
  return loadThemes();
}

export function saveThemesData(data) {
  const names = (data.themes || []).map((t) => String(t.name || '').trim().toLowerCase());
  const seen = new Set();
  for (const n of names) {
    if (n && seen.has(n)) {
      throw new Error('Theme names must be unique');
    }
    if (n) seen.add(n);
  }
  return saveThemes(data);
}
