# Changelog

## [1.0.0] – Current (pre-fork)

### Gmail (gWrassler)

- Query builder with Gmail operators (contains, older_than, newer_than, from, to, subject, label, has, in, is, category, size)
- Negate clauses (NOT) via ⊖ icon
- Saved queries (JSON file)
- Batch size control (5–500 results per page)
- Sortable results (From, Date Received, Size)
- Mass delete (Move to Trash)
- Action log (persistent)
- Tabs: Search, Account, Tab 3
- Account tab: email, aliases, messages/threads, inbox unread, total unread, Sent/Trash/Spam/Drafts counts, storage usage
- OAuth: Gmail + Drive APIs

### Home (Links)

- Saved links organized by **categories** (JSON via `GET/PUT /api/links`)
- Add, edit, and delete links and categories; reorder within the UI
- Category strip with auxiliary control (⋯) to show or hide the category list
- **Home metadata**: live clock and session info (`GET /api/session-info`, e.g. client IP)

### Palette

- **10-slot** theme editor (semantic CSS variables: background, surface, borders, text, accents, danger, success, etc.)
- Editors: RGBA sliders/numbers, HSL, HSV, hex (with copy)
- **Saved themes** stored on the server (`GET/PUT /api/themes`); apply a theme to the app or load it into the editor
- **Save theme** (new, named) vs **Save updates** (overwrite selected theme); **Clear** resets the editor and document colors to the built-in default
- **Selection** of a saved theme (highlighted row) persisted in `localStorage` and restored on reload

### Translate

- **Workspace**: translate English text to multiple target languages in one request (`POST /api/translate`, MyMemory-backed on the server)
- **Daily sentences**: curated lines from `/data/daily-sentences.json`, one set per calendar day (day-of-year index), with **previous / next** navigation and per-line copy; links open Google Translate for a chosen pair
- Toolbar control height aligned with the left **nav** chrome (`--bar-height` / `--chrome-size`)

### App shell

- **Hash routing** between Home, Gmail, Palette, and Translate (`#home`, `#gmail`, `#palette`, `#translate`)
- Left **icon rail** + header title area; optional Google sign-in state in the header for Gmail
