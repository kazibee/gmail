# @kazibee/gmail

Gmail tool for kazibee. Supports message read/send/reply, labels, drafts, filters, and attachments (local + Google Drive).

## Install

```bash
kazibee install gmail github:kazibee/gmail
```

Install globally with `-g`:

```bash
kazibee install -g gmail github:kazibee/gmail
```

## Login

```bash
kazibee gmail login
```

Notes:
- Login grants Gmail and Drive read scope used for Drive attachments.
- Re-run login after scope changes to refresh token permissions.

## API

### Messages
- `listMessages(query?, maxResults?)`
- `getMessage(messageId)`
- `sendMessage(to, subject, body)`
- `sendHtmlMessage(to, subject, htmlBody)`
- `replyToMessage(messageId, body)`
- `trashMessage(messageId)`
- `untrashMessage(messageId)`

### Labels
- `listLabels()`
- `addLabels(messageId, labelIds)`
- `removeLabels(messageId, labelIds)`

### Drafts
- `createDraft(to, subject, body)`
- `createDraftWithAttachments(to, subject, body, attachments)`
- `createDraftWithDriveAttachments(to, subject, body, attachments)`
- `listDrafts()`

### Attachments
- `listAttachments(messageId)`
- `downloadAttachment(messageId, attachmentId, outputPath)`
- `downloadAttachmentPart(messageId, partId, outputPath)`
- `sendMessageWithAttachments(to, subject, body, attachments)`
- `sendMessageWithDriveAttachments(to, subject, body, attachments)`

### Filters
- `listFilters()`
- `createFilter(criteria, action)`
- `deleteFilter(filterId)`

## Usage

```javascript
// Send with local file attachments
await tools["gmail"].sendMessageWithAttachments(
  "ops@example.com",
  "Weekly Report",
  "Attached report and export.",
  [
    { path: "/tmp/report.pdf" },
    { path: "/tmp/export.csv", filename: "metrics.csv", mimeType: "text/csv" }
  ]
);

// Send with Google Drive attachments by file ID
await tools["gmail"].sendMessageWithDriveAttachments(
  "ops@example.com",
  "Drive Attachments",
  "Attaching files directly from Drive IDs.",
  [
    { fileId: "1abcDriveFileId" },
    { fileId: "1defDriveFileId", filename: "renamed.pdf" }
  ]
);

// Download attachment from a received message
const parts = await tools["gmail"].listAttachments("18c7f0abc123");
await tools["gmail"].downloadAttachmentPart(
  "18c7f0abc123",
  parts[0].partId,
  "/tmp/downloaded.bin"
);
```
