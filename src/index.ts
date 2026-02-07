import { createAuthClient, type Env } from './auth';
import { createGmailClient } from './gmail-client';

export type { Env } from './auth';
export type {
  MessageSummary,
  Message,
  Label,
  DraftSummary,
  SentMessage,
  GmailFilter,
  FilterCriteria,
  FilterAction,
} from './gmail-client';

export default function main(env: Env) {
  const auth = createAuthClient(env);
  return createGmailClient(auth);
}
