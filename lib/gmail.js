import { google } from 'googleapis';

const DEFAULT_PAGE_SIZE = 50;

/**
 * Search Gmail messages with a query.
 * @param {object} auth - Authorized OAuth2 client
 * @param {string} query - Gmail search query (e.g. "older_than:1y in:inbox")
 * @param {string} [pageToken] - Pagination token
 * @param {number} [maxResults=50] - Results per page (5-500)
 * @returns {Promise<{ messages: Array, nextPageToken?: string, resultSizeEstimate: number }>}
 */
export async function searchMessages(auth, query, pageToken, maxResults = DEFAULT_PAGE_SIZE) {
  const gmail = google.gmail({ version: 'v1', auth });
  const size = Math.max(5, Math.min(500, maxResults));

  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: size,
    pageToken: pageToken || undefined,
  });

  const messages = data.messages || [];
  const details = await Promise.all(
    messages.map((msg) =>
      gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
        metadataHeaders: ['From', 'To', 'Subject', 'Date'],
      })
    )
  );

  const enriched = details.map((res) => {
    const payload = res.data.payload;
    const headers = (payload?.headers || []).reduce((acc, h) => {
      acc[h.name.toLowerCase()] = h.value;
      return acc;
    }, {});

    return {
      id: res.data.id,
      threadId: res.data.threadId,
      subject: headers.subject || '(no subject)',
      from: headers.from || '',
      to: headers.to || '',
      date: res.data.internalDate ? new Date(parseInt(res.data.internalDate)).toISOString() : null,
      snippet: res.data.snippet || '',
      sizeEstimate: res.data.sizeEstimate ?? 0,
    };
  });

  return {
    messages: enriched,
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate ?? 0,
  };
}

/**
 * Get count of messages matching query (estimate from API).
 */
export async function getSearchCount(auth, query) {
  const gmail = google.gmail({ version: 'v1', auth });
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 1,
  });
  return data.resultSizeEstimate ?? 0;
}

/**
 * Move messages to Trash.
 * @param {object} auth - Authorized OAuth2 client
 * @param {string[]} messageIds - Array of message IDs
 */
export async function trashMessages(auth, messageIds) {
  const gmail = google.gmail({ version: 'v1', auth });

  // Gmail API allows batchModify for labels but not for trash - we need to call trash per message
  // For efficiency, we could use Promise.all with a reasonable concurrency
  const results = await Promise.allSettled(
    messageIds.map((id) => gmail.users.messages.trash({ userId: 'me', id }))
  );

  const failed = results
    .map((r, i) => (r.status === 'rejected' ? messageIds[i] : null))
    .filter(Boolean);

  return { success: failed.length === 0, failed };
}
