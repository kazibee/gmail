export interface Env {
	CLIENT_ID: string;
	CLIENT_SECRET: string;
	REFRESH_TOKEN: string;
}
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
export interface FilterCriteria {
	from?: string;
	to?: string;
	subject?: string;
	query?: string;
	negatedQuery?: string;
	hasAttachment?: boolean;
	excludeChats?: boolean;
	size?: number;
	sizeComparison?: "larger" | "smaller";
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
declare function main(env: Env): {
	listMessages: (query?: string, maxResults?: number) => Promise<MessageSummary[]>;
	listMessageSummaries: (query?: string, maxResults?: number) => Promise<MessageListSummary[]>;
	getMessage: (messageId: string) => Promise<Message>;
	sendMessage: (to: string, subject: string, body: string) => Promise<SentMessage>;
	sendHtmlMessage: (to: string, subject: string, htmlBody: string) => Promise<SentMessage>;
	replyToMessage: (messageId: string, body: string) => Promise<SentMessage>;
	trashMessage: (messageId: string) => Promise<void>;
	untrashMessage: (messageId: string) => Promise<void>;
	listLabels: () => Promise<Label[]>;
	addLabels: (messageId: string, labelIds: string[]) => Promise<void>;
	removeLabels: (messageId: string, labelIds: string[]) => Promise<void>;
	createDraft: (to: string, subject: string, body: string) => Promise<DraftSummary>;
	createDraftWithAttachments: (to: string, subject: string, body: string, attachments: SendAttachmentInput[]) => Promise<DraftSummary>;
	createDraftWithDriveAttachments: (to: string, subject: string, body: string, attachments: DriveAttachmentInput[]) => Promise<DraftSummary>;
	listDrafts: () => Promise<DraftSummary[]>;
	listAttachments: (messageId: string) => Promise<AttachmentSummary[]>;
	downloadAttachment: (messageId: string, attachmentId: string, outputPath: string) => Promise<{
		outputPath: string;
		sizeBytes: number;
	}>;
	downloadAttachmentPart: (messageId: string, partId: string, outputPath: string) => Promise<{
		outputPath: string;
		sizeBytes: number;
	}>;
	sendMessageWithAttachments: (to: string, subject: string, body: string, attachments: SendAttachmentInput[]) => Promise<SentMessage>;
	sendMessageWithDriveAttachments: (to: string, subject: string, body: string, attachments: DriveAttachmentInput[]) => Promise<SentMessage>;
	listFilters: () => Promise<GmailFilter[]>;
	createFilter: (criteria: FilterCriteria, action: FilterAction) => Promise<GmailFilter>;
	deleteFilter: (filterId: string) => Promise<void>;
};

export {
	main as default,
};

export {};
