import { google } from 'googleapis';

/**
 * Fetch Gmail profile, Drive storage, aliases, and label counts for the authenticated user.
 * @param {object} auth - Authorized OAuth2 client
 */
export async function getAccountData(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });

  const [profileRes, aboutRes, sendAsRes, labelsRes] = await Promise.all([
    gmail.users.getProfile({ userId: 'me' }),
    drive.about.get({ fields: 'storageQuota' }).catch((err) => {
      console.error('Drive about.get failed:', err.message);
      return { data: { storageQuota: {} } };
    }),
    gmail.users.settings.sendAs.list({ userId: 'me' }).catch(() => ({ data: { sendAs: [] } })),
    gmail.users.labels.list({ userId: 'me' }).catch(() => ({ data: { labels: [] } })),
  ]);

  const profile = profileRes.data;
  const quota = aboutRes.data?.storageQuota || {};
  const sendAsList = sendAsRes.data?.sendAs || [];
  const labelsList = labelsRes.data?.labels || [];

  const storageUsed = parseInt(quota.usage, 10) || 0;
  const storageLimit = quota.limit ? parseInt(quota.limit, 10) : undefined;

  const aliases = sendAsList.map((a) => a.sendAsEmail).filter(Boolean);

  const labelIds = ['INBOX', 'UNREAD', 'SENT', 'TRASH', 'SPAM', 'DRAFT'];
  const labelDetails = await Promise.all(
    labelIds.map((id) =>
      gmail.users.labels.get({ userId: 'me', id }).catch(() => null)
    )
  );

  const labelCounts = {};
  labelDetails.forEach((res, i) => {
    if (res?.data) {
      const id = labelIds[i];
      labelCounts[id] = {
        total: res.data.messagesTotal ?? 0,
        unread: res.data.messagesUnread ?? 0,
      };
    }
  });

  return {
    email: profile.emailAddress || '',
    messagesTotal: profile.messagesTotal ?? 0,
    threadsTotal: profile.threadsTotal ?? 0,
    storageUsed,
    storageLimit,
    aliases,
    labelCounts,
  };
}
