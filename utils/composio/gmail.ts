import { logger } from "../logger";
import { ToolsetManager } from "./toolsetmanager";

interface EmailMessage {
  threadId: string;
  messageId: string;
  messageTimestamp: string;
  labelIds: string[];
  preview: {
    subject: string;
    body: string;
  };
  messageText: string;
}

interface EmailResponse {
  messages: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}

export async function fetchEmailFromLastMonth(entityId: string): Promise<EmailMessage[]> {
  const toolset = ToolsetManager.getToolset();
  const entity = await toolset.client.getEntity(entityId);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);

  const query = `
    subject:(
      "order" OR 
      "shipped" OR 
      "delivery" OR 
      "tracking" OR 
      "purchase" OR 
      "confirmation" OR
      "your order" OR
      "has shipped" OR
      "order status" OR
      "order confirmed" OR
      "order received"
    )
  `.replace(/\s+/g, ' ').trim();

  const rawResult = await entity.execute({
    actionName: "GMAIL_FETCH_EMAILS",
    params: {
      query,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }
  });

  const response_data = rawResult.data?.response_data as EmailResponse;
  if (!response_data?.messages) {
    return [];
  }

  return response_data.messages;
}


