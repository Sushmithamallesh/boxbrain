export interface EmailMessage {
  threadId: string;
  messageId: string;
  messageTimestamp: string;
  labelIds: string[];
  preview: {
    subject: string;
    body: string;
  };
  messageText: string;
  sender: string;
}

export interface EmailResponse {
  messages: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
} 