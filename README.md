# gWrassler

Gmail inbox management: targeted search, mass delete, and account metadata.

## Features

- **Search** – Query builder with Gmail operators (clauses for from, to, subject, date, size, labels, etc.)
- **Negate clauses** – Toggle NOT for any clause (e.g. `-from:spam@example.com`)
- **Saved queries** – Save and load queries via JSON file
- **Results** – Sortable table (From, Date, Size); batch size; move to Trash
- **Action log** – Persistent log of searches and deletes
- **Account tab** – Email, aliases, messages/threads, read/unread counts, label counts (Sent, Trash, Spam, Drafts), storage usage
- **Tabs** – Search, Account, and Tab 3 (placeholder)

## Setup

1. **Google Cloud Console**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Enable the **Gmail API** and **Google Drive API**
   - Create OAuth 2.0 credentials (Desktop app or Web application)
   - Add `http://localhost:3001/oauth2callback` to authorized redirect URIs (if using Web app)
   - Download credentials and save as `credentials.json` in this folder

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run**
   ```bash
   npm start
   ```

4. Open `http://localhost:3001` in your browser, sign in with Google, then search and manage your inbox.

## Search operators

Use the query builder or Gmail search syntax:

- `older_than:1y` / `newer_than:30d` – date ranges
- `in:inbox` – inbox only
- `from:newsletter@example.com` – from a specific sender
- `subject:receipt` – subject contains "receipt"
- `category:promotions` – promotions tab
- `size:5m` – size larger than 5 MB
- `has:attachment` – has attachment

Combine them: `older_than:2y in:inbox category:promotions`

## Data

- `data/saved-queries.json` – Saved queries
- `data/action-log.json` – Action log
- `token.json` – OAuth token (created on login)

## OAuth scopes

- `gmail.readonly` – Read mail
- `gmail.modify` – Trash, delete
- `gmail.settings.basic` – Aliases (send-as)
- `drive.readonly` – Storage quota
