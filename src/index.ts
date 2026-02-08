import { createAuthClient, type Env } from './auth';
import { createGmailClient } from './gmail-client';

export type { Env } from './auth';
export type {
  MessageSummary,
  MessageListSummary,
  Message,
  Label,
  DraftSummary,
  SentMessage,
  SendAttachmentInput,
  DriveAttachmentInput,
  AttachmentSummary,
  GmailFilter,
  FilterCriteria,
  FilterAction,
} from './gmail-client';

export default function main(env: Env) {
  const auth = createAuthClient(env);
  return createGmailClient(auth);
}
