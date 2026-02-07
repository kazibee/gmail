import { gmail as createGmail, type gmail_v1 } from '@googleapis/gmail';
import type { OAuth2Client } from 'google-auth-library';

type GmailAPI = gmail_v1.Gmail;

export function createGmailClient(auth: OAuth2Client) {
  const api = createGmail({ version: 'v1', auth });

  return {
    listMessages: (query?: string, maxResults?: number) =>
      listMessages(api, query, maxResults),
    getMessage: (messageId: string) => getMessage(api, messageId),
    sendMessage: (to: string, subject: string, body: string) =>
      sendMessage(api, to, subject, body),
    sendHtmlMessage: (to: string, subject: string, htmlBody: string) =>
      sendHtmlMessage(api, to, subject, htmlBody),
    replyToMessage: (messageId: string, body: string) =>
      replyToMessage(api, messageId, body),
    trashMessage: (messageId: string) => trashMessage(api, messageId),
    untrashMessage: (messageId: string) => untrashMessage(api, messageId),
    listLabels: () => listLabels(api),
    addLabels: (messageId: string, labelIds: string[]) =>
      modifyLabels(api, messageId, labelIds, []),
    removeLabels: (messageId: string, labelIds: string[]) =>
      modifyLabels(api, messageId, [], labelIds),
    createDraft: (to: string, subject: string, body: string) =>
      createDraft(api, to, subject, body),
    listDrafts: () => listDrafts(api),
  };
}

// -- Types --

export interface MessageSummary {
  id: string;
  threadId: string;
  snippet: string;
}

export interface Message {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  body: string;
  labelIds: string[];
}

export interface Label {
  id: string;
  name: string;
  type: string;
}

export interface DraftSummary {
  id: string;
  messageId: string;
  snippet: string;
}

export interface SentMessage {
  id: string;
  threadId: string;
  labelIds: string[];
}

// -- List / Get --

async function listMessages(
  api: GmailAPI,
  query?: string,
  maxResults = 20,
): Promise<MessageSummary[]> {
  const res = await api.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });
  return (res.data.messages ?? []).map((m) => ({
    id: m.id!,
    threadId: m.threadId!,
    snippet: '',
  }));
}

async function getMessage(api: GmailAPI, messageId: string): Promise<Message> {
  const res = await api.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });
  return mapMessage(res.data);
}

// -- Send / Reply --

async function sendMessage(
  api: GmailAPI,
  to: string,
  subject: string,
  body: string,
): Promise<SentMessage> {
  const raw = buildRawEmail(to, subject, body, 'text/plain');
  const res = await api.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return mapSentMessage(res.data);
}

async function sendHtmlMessage(
  api: GmailAPI,
  to: string,
  subject: string,
  htmlBody: string,
): Promise<SentMessage> {
  const raw = buildRawEmail(to, subject, htmlBody, 'text/html');
  const res = await api.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return mapSentMessage(res.data);
}

async function replyToMessage(
  api: GmailAPI,
  messageId: string,
  body: string,
): Promise<SentMessage> {
  const original = await getMessage(api, messageId);
  const subject = original.subject.startsWith('Re:')
    ? original.subject
    : `Re: ${original.subject}`;

  const raw = buildRawEmail(original.from, subject, body, 'text/plain', {
    'In-Reply-To': messageId,
    References: messageId,
  });

  const res = await api.users.messages.send({
    userId: 'me',
    requestBody: { raw, threadId: original.threadId },
  });
  return mapSentMessage(res.data);
}

// -- Trash --

async function trashMessage(api: GmailAPI, messageId: string): Promise<void> {
  await api.users.messages.trash({ userId: 'me', id: messageId });
}

async function untrashMessage(api: GmailAPI, messageId: string): Promise<void> {
  await api.users.messages.untrash({ userId: 'me', id: messageId });
}

// -- Labels --

async function listLabels(api: GmailAPI): Promise<Label[]> {
  const res = await api.users.labels.list({ userId: 'me' });
  return (res.data.labels ?? []).map((l) => ({
    id: l.id!,
    name: l.name!,
    type: l.type ?? 'user',
  }));
}

async function modifyLabels(
  api: GmailAPI,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[],
): Promise<void> {
  await api.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });
}

// -- Drafts --

async function createDraft(
  api: GmailAPI,
  to: string,
  subject: string,
  body: string,
): Promise<DraftSummary> {
  const raw = buildRawEmail(to, subject, body, 'text/plain');
  const res = await api.users.drafts.create({
    userId: 'me',
    requestBody: { message: { raw } },
  });
  return {
    id: res.data.id!,
    messageId: res.data.message?.id ?? '',
    snippet: '',
  };
}

async function listDrafts(api: GmailAPI): Promise<DraftSummary[]> {
  const res = await api.users.drafts.list({ userId: 'me' });
  return (res.data.drafts ?? []).map((d) => ({
    id: d.id!,
    messageId: d.message?.id ?? '',
    snippet: '',
  }));
}

// -- Helpers --

function buildRawEmail(
  to: string,
  subject: string,
  body: string,
  contentType: string,
  extraHeaders?: Record<string, string>,
): string {
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}; charset="UTF-8"`,
  ];

  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.push(`${key}: ${value}`);
    }
  }

  const email = `${headers.join('\r\n')}\r\n\r\n${body}`;
  return Buffer.from(email).toString('base64url');
}

function mapMessage(data: gmail_v1.Schema$Message): Message {
  const headers = data.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';

  return {
    id: data.id!,
    threadId: data.threadId!,
    snippet: data.snippet ?? '',
    from: getHeader('From'),
    to: getHeader('To'),
    subject: getHeader('Subject'),
    date: getHeader('Date'),
    body: extractBody(data.payload),
    labelIds: data.labelIds ?? [],
  };
}

function extractBody(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return '';

  // Simple single-part message
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // Multipart — prefer text/plain, fall back to text/html
  const parts = payload.parts ?? [];
  const textPart = parts.find((p) => p.mimeType === 'text/plain');
  if (textPart?.body?.data) {
    return Buffer.from(textPart.body.data, 'base64url').toString('utf-8');
  }

  const htmlPart = parts.find((p) => p.mimeType === 'text/html');
  if (htmlPart?.body?.data) {
    return Buffer.from(htmlPart.body.data, 'base64url').toString('utf-8');
  }

  // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
  for (const part of parts) {
    const nested = extractBody(part);
    if (nested) return nested;
  }

  return '';
}

function mapSentMessage(data: gmail_v1.Schema$Message): SentMessage {
  return {
    id: data.id!,
    threadId: data.threadId!,
    labelIds: data.labelIds ?? [],
  };
}
