import { gmail as createGmail, type gmail_v1 } from '@googleapis/gmail';
import { drive as createDrive, type drive_v3 } from '@googleapis/drive';
import { Readable } from 'node:stream';

type GmailAPI = gmail_v1.Gmail;
type DriveAPI = drive_v3.Drive;
const LIST_SUMMARY_BATCH_SIZE = 5;

/**
 * Creates the Gmail tool client using a shared OAuth auth instance.
 *
 * The returned object contains message, draft, label, filter, and attachment helpers.
 */
export function createGmailClient(auth: unknown) {
  const api = createGmail({ version: 'v1', auth: auth as any });
  const drive = createDrive({ version: 'v3', auth: auth as any });

  return {
    listMessages: (query?: string, maxResults?: number) =>
      listMessages(api, query, maxResults),
    listMessageSummaries: (query?: string, maxResults?: number) =>
      listMessageSummaries(api, query, maxResults),
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
    createDraftWithAttachments: (
      to: string,
      subject: string,
      body: string,
      attachments: SendAttachmentInput[],
    ) => createDraftWithAttachments(api, to, subject, body, attachments),
    createDraftWithDriveAttachments: (
      to: string,
      subject: string,
      body: string,
      attachments: DriveAttachmentInput[],
    ) => createDraftWithDriveAttachments(api, drive, to, subject, body, attachments),
    listDrafts: () => listDrafts(api),
    listAttachments: (messageId: string) => listAttachments(api, messageId),
    downloadAttachment: (messageId: string, attachmentId: string, outputPath: string) =>
      downloadAttachment(api, messageId, attachmentId, outputPath),
    downloadAttachmentPart: (messageId: string, partId: string, outputPath: string) =>
      downloadAttachmentPart(api, messageId, partId, outputPath),
    sendMessageWithAttachments: (
      to: string,
      subject: string,
      body: string,
      attachments: SendAttachmentInput[],
    ) => sendMessageWithAttachments(api, to, subject, body, attachments),
    sendMessageWithDriveAttachments: (
      to: string,
      subject: string,
      body: string,
      attachments: DriveAttachmentInput[],
    ) => sendMessageWithDriveAttachments(api, drive, to, subject, body, attachments),
    listFilters: () => listFilters(api),
    createFilter: (criteria: FilterCriteria, action: FilterAction) =>
      createFilter(api, criteria, action),
    deleteFilter: (filterId: string) => deleteFilter(api, filterId),
  };
}

// -- Types --

export interface MessageSummary {
  id: string;
  threadId: string;
  snippet: string;
}

export interface MessageListSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
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

/** Local filesystem attachment input for send/draft APIs. */
export interface SendAttachmentInput {
  /** Local path to file to attach. */
  path: string;
  /** Optional filename override shown in email. */
  filename?: string;
  /** Optional MIME type override for the attachment. */
  mimeType?: string;
}

/** Google Drive attachment input for send/draft APIs. */
export interface DriveAttachmentInput {
  /** Drive file ID to fetch and attach. */
  fileId: string;
  /** Optional filename override shown in email. */
  filename?: string;
  /** Optional MIME type override for the attachment. */
  mimeType?: string;
}

/** Attachment metadata extracted from a message payload. */
export interface AttachmentSummary {
  /** Gmail message part ID. */
  partId: string;
  /** Gmail attachment ID when body is externalized. */
  attachmentId?: string;
  /** Attachment filename (may be empty for inline data). */
  filename: string;
  /** Attachment MIME type. */
  mimeType: string;
  /** Attachment size in bytes as reported by Gmail. */
  size: number;
}

interface AttachmentPayload {
  filename: string;
  mimeType: string;
  base64Data: string;
}

export interface FilterCriteria {
  from?: string;
  to?: string;
  subject?: string;
  query?: string;
  negatedQuery?: string;
  hasAttachment?: boolean;
  excludeChats?: boolean;
  size?: number;
  sizeComparison?: 'larger' | 'smaller';
}

export interface FilterAction {
  addLabelIds?: string[];
  removeLabelIds?: string[];
  forward?: string;
}

export interface GmailFilter {
  id: string;
  criteria: FilterCriteria;
  action: FilterAction;
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
    snippet: m.snippet ?? '',
  }));
}

async function listMessageSummaries(
  api: GmailAPI,
  query?: string,
  maxResults = 20,
): Promise<MessageListSummary[]> {
  const res = await api.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  });

  const refs = (res.data.messages ?? []).filter(
    (message): message is gmail_v1.Schema$Message & { id: string } => !!message.id,
  );
  const summaries: MessageListSummary[] = [];

  for (let i = 0; i < refs.length; i += LIST_SUMMARY_BATCH_SIZE) {
    const batch = refs.slice(i, i + LIST_SUMMARY_BATCH_SIZE);
    const batchSummaries = await Promise.all(
      batch.map(async (ref) => {
        const detail = await api.users.messages.get({
          userId: 'me',
          id: ref.id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = detail.data.payload?.headers;
        return {
          id: detail.data.id ?? ref.id,
          threadId: detail.data.threadId ?? ref.threadId ?? '',
          from: getHeaderValue(headers, 'From'),
          subject: getHeaderValue(headers, 'Subject'),
          date: getHeaderValue(headers, 'Date'),
          snippet: detail.data.snippet ?? ref.snippet ?? '',
        };
      }),
    );

    summaries.push(...batchSummaries);
  }

  return summaries;
}

function getHeaderValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return headers?.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}

function mapMessageHeaders(data: gmail_v1.Schema$Message): Pick<Message, 'from' | 'to' | 'subject' | 'date'> {
  const headers = data.payload?.headers;
  return {
    from: getHeaderValue(headers, 'From'),
    to: getHeaderValue(headers, 'To'),
    subject: getHeaderValue(headers, 'Subject'),
    date: getHeaderValue(headers, 'Date'),
  };
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

async function sendMessageWithAttachments(
  api: GmailAPI,
  to: string,
  subject: string,
  body: string,
  attachments: SendAttachmentInput[],
): Promise<SentMessage> {
  const payloads = await readLocalAttachmentPayloads(attachments);
  const raw = buildRawEmailWithAttachments(to, subject, body, payloads);
  const res = await api.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
  return mapSentMessage(res.data);
}

async function sendMessageWithDriveAttachments(
  api: GmailAPI,
  drive: DriveAPI,
  to: string,
  subject: string,
  body: string,
  attachments: DriveAttachmentInput[],
): Promise<SentMessage> {
  // Fetch Drive files as binary payloads, then attach as MIME parts.
  const payloads = await readDriveAttachmentPayloads(drive, attachments);
  const raw = buildRawEmailWithAttachments(to, subject, body, payloads);
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

async function createDraftWithAttachments(
  api: GmailAPI,
  to: string,
  subject: string,
  body: string,
  attachments: SendAttachmentInput[],
): Promise<DraftSummary> {
  const payloads = await readLocalAttachmentPayloads(attachments);
  const raw = buildRawEmailWithAttachments(to, subject, body, payloads);
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

async function createDraftWithDriveAttachments(
  api: GmailAPI,
  drive: DriveAPI,
  to: string,
  subject: string,
  body: string,
  attachments: DriveAttachmentInput[],
): Promise<DraftSummary> {
  // Fetch Drive files as binary payloads, then attach as MIME parts.
  const payloads = await readDriveAttachmentPayloads(drive, attachments);
  const raw = buildRawEmailWithAttachments(to, subject, body, payloads);
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

// -- Attachments --

async function listAttachments(api: GmailAPI, messageId: string): Promise<AttachmentSummary[]> {
  const res = await api.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const parts = flattenParts(res.data.payload);
  return parts
    .filter((part) => !!part.filename || !!part.body?.attachmentId)
    .map((part) => ({
      partId: part.partId ?? '',
      attachmentId: part.body?.attachmentId ?? undefined,
      filename: part.filename ?? '',
      mimeType: part.mimeType ?? 'application/octet-stream',
      size: part.body?.size ?? 0,
    }));
}

async function downloadAttachment(
  api: GmailAPI,
  messageId: string,
  attachmentId: string,
  outputPath: string,
): Promise<{ outputPath: string; sizeBytes: number }> {
  const res = await api.users.messages.attachments.get({
    userId: 'me',
    messageId,
    id: attachmentId,
  });

  const data = res.data.data ?? '';
  const bytes = Buffer.from(data, 'base64url');
  await Bun.write(outputPath, bytes);
  return { outputPath, sizeBytes: bytes.length };
}

async function downloadAttachmentPart(
  api: GmailAPI,
  messageId: string,
  partId: string,
  outputPath: string,
): Promise<{ outputPath: string; sizeBytes: number }> {
  const res = await api.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const part = flattenParts(res.data.payload).find((p) => p.partId === partId);
  if (!part) {
    throw new Error(`Attachment part not found: ${partId}`);
  }

  if (part.body?.data) {
    const bytes = Buffer.from(part.body.data, 'base64url');
    await Bun.write(outputPath, bytes);
    return { outputPath, sizeBytes: bytes.length };
  }

  if (part.body?.attachmentId) {
    return downloadAttachment(api, messageId, part.body.attachmentId, outputPath);
  }

  throw new Error(`Part ${partId} does not contain attachment data.`);
}

// -- Filters --

async function listFilters(api: GmailAPI): Promise<GmailFilter[]> {
  const res = await api.users.settings.filters.list({ userId: 'me' });
  return (res.data.filter ?? []).map(mapFilter);
}

async function createFilter(
  api: GmailAPI,
  criteria: FilterCriteria,
  action: FilterAction,
): Promise<GmailFilter> {
  const res = await api.users.settings.filters.create({
    userId: 'me',
    requestBody: {
      criteria: mapFilterCriteria(criteria),
      action: mapFilterAction(action),
    },
  });
  return mapFilter(res.data);
}

async function deleteFilter(api: GmailAPI, filterId: string): Promise<void> {
  await api.users.settings.filters.delete({
    userId: 'me',
    id: filterId,
  });
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

function buildRawEmailWithAttachments(
  to: string,
  subject: string,
  body: string,
  attachments: AttachmentPayload[],
): string {
  if (!attachments.length) {
    return buildRawEmail(to, subject, body, 'text/plain');
  }

  const boundary = `gmail_tool_boundary_${Date.now()}`;
  const headers = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ];

  const parts: string[] = [];
  parts.push(
    `--${boundary}\r\n` +
      `Content-Type: text/plain; charset="UTF-8"\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `${body}\r\n`,
  );

  for (const attachment of attachments) {
    const wrapped = attachment.base64Data.replace(/(.{76})/g, '$1\r\n');

    parts.push(
      `--${boundary}\r\n` +
        `Content-Type: ${attachment.mimeType}; name="${sanitizeHeaderValue(attachment.filename)}"\r\n` +
        `Content-Disposition: attachment; filename="${sanitizeHeaderValue(attachment.filename)}"\r\n` +
        `Content-Transfer-Encoding: base64\r\n\r\n` +
        `${wrapped}\r\n`,
    );
  }

  parts.push(`--${boundary}--`);
  const email = `${headers.join('\r\n')}\r\n\r\n${parts.join('')}`;
  return Buffer.from(email).toString('base64url');
}

function mapMessage(data: gmail_v1.Schema$Message): Message {
  const headerValues = mapMessageHeaders(data);

  return {
    id: data.id!,
    threadId: data.threadId!,
    snippet: data.snippet ?? '',
    from: headerValues.from,
    to: headerValues.to,
    subject: headerValues.subject,
    date: headerValues.date,
    body: extractBody(data.payload),
    labelIds: data.labelIds ?? [],
  };
}

function flattenParts(payload?: gmail_v1.Schema$MessagePart): gmail_v1.Schema$MessagePart[] {
  if (!payload) return [];
  const out: gmail_v1.Schema$MessagePart[] = [];
  const stack: gmail_v1.Schema$MessagePart[] = [payload];

  while (stack.length) {
    const part = stack.pop()!;
    out.push(part);
    for (const child of part.parts ?? []) {
      stack.push(child);
    }
  }

  return out;
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

function mapFilter(data: gmail_v1.Schema$Filter): GmailFilter {
  const criteria = data.criteria;
  const action = data.action;
  const sizeComparison =
    criteria?.sizeComparison === 'larger' || criteria?.sizeComparison === 'smaller'
      ? criteria.sizeComparison
      : undefined;

  return {
    id: data.id ?? '',
    criteria: {
      from: criteria?.from ?? undefined,
      to: criteria?.to ?? undefined,
      subject: criteria?.subject ?? undefined,
      query: criteria?.query ?? undefined,
      negatedQuery: criteria?.negatedQuery ?? undefined,
      hasAttachment: criteria?.hasAttachment ?? undefined,
      excludeChats: criteria?.excludeChats ?? undefined,
      size: criteria?.size ?? undefined,
      sizeComparison,
    },
    action: {
      addLabelIds: action?.addLabelIds ?? undefined,
      removeLabelIds: action?.removeLabelIds ?? undefined,
      forward: action?.forward ?? undefined,
    },
  };
}

function mapFilterCriteria(
  criteria: FilterCriteria,
): gmail_v1.Schema$FilterCriteria {
  return {
    from: criteria.from,
    to: criteria.to,
    subject: criteria.subject,
    query: criteria.query,
    negatedQuery: criteria.negatedQuery,
    hasAttachment: criteria.hasAttachment,
    excludeChats: criteria.excludeChats,
    size: criteria.size,
    sizeComparison: criteria.sizeComparison,
  };
}

function mapFilterAction(action: FilterAction): gmail_v1.Schema$FilterAction {
  return {
    addLabelIds: action.addLabelIds,
    removeLabelIds: action.removeLabelIds,
    forward: action.forward,
  };
}

function inferMimeTypeFromFilename(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'application/octet-stream';
}

async function readLocalAttachmentPayloads(
  attachments: SendAttachmentInput[],
): Promise<AttachmentPayload[]> {
  const payloads: AttachmentPayload[] = [];
  for (const attachment of attachments) {
    const file = Bun.file(attachment.path);
    const exists = await file.exists();
    if (!exists) {
      throw new Error(`Attachment file not found: ${attachment.path}`);
    }

    const filename = attachment.filename || attachment.path.split('/').pop() || 'attachment.bin';
    const mimeType = attachment.mimeType || file.type || inferMimeTypeFromFilename(filename);
    const base64Data = Buffer.from(await file.arrayBuffer()).toString('base64');
    payloads.push({ filename, mimeType, base64Data });
  }
  return payloads;
}

async function readDriveAttachmentPayloads(
  drive: DriveAPI,
  attachments: DriveAttachmentInput[],
): Promise<AttachmentPayload[]> {
  const payloads: AttachmentPayload[] = [];

  for (const attachment of attachments) {
    const metaRes = await drive.files.get({
      fileId: attachment.fileId,
      fields: 'name,mimeType',
      supportsAllDrives: true,
    });

    const contentRes = await drive.files.get(
      {
        fileId: attachment.fileId,
        alt: 'media',
        supportsAllDrives: true,
      },
      {
        // Force binary payload from gaxios.
        responseType: 'arraybuffer',
      } as any,
    );

    const filename =
      attachment.filename ||
      metaRes.data.name ||
      `drive-file-${attachment.fileId}`;
    const mimeType =
      attachment.mimeType ||
      metaRes.data.mimeType ||
      inferMimeTypeFromFilename(filename);
    const base64Data = (await toBuffer(contentRes.data)).toString('base64');

    payloads.push({ filename, mimeType, base64Data });
  }

  return payloads;
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n"]/g, '_');
}

async function toBuffer(data: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof data === 'string') {
    return Buffer.from(data);
  }
  if (data instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error(`Unsupported drive content payload type: ${typeof data}`);
}
