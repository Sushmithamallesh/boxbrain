import { ToolsetManager } from "./toolsetmanager-singleton";
import { EmailMessage, EmailResponse } from "./types";
import { logger } from "@/utils/logger";

function buildOrderQuery(startDate: Date, endDate: Date): string {
  // Format dates as YYYY/MM/DD for Gmail query
  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0].replace(/-/g, '/');
  };

  return `
    after:${formatDate(startDate)} before:${formatDate(endDate)}
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
      "order received" OR
      "payment failed" OR
      "payment declined" OR
      "payment unsuccessful" OR
      "transaction failed"
    )
  `.replace(/\s+/g, ' ').trim();
}

export async function fetchEmailFromLastMonth(entityId: string): Promise<EmailMessage[]> {
  const toolset = ToolsetManager.getToolset();
  const entity = await toolset.client.getEntity(entityId);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);

  logger.info('Fetching emails from last month', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  const query = buildOrderQuery(startDate, endDate);
  logger.debug('Gmail query', { query });

  const rawResult = await entity.execute({
    actionName: "GMAIL_FETCH_EMAILS",
    params: {
      query,
      max_results: 100
    }
  });

  const response_data = rawResult.data?.response_data as EmailResponse;
  if (!response_data?.messages) {
    return [];
  }

  return response_data.messages;
}

export async function fetchEmailFromTime(
  entityId: string,
  startDate: Date
): Promise<EmailMessage[]> {
  const toolset = ToolsetManager.getToolset();
  const entity = await toolset.client.getEntity(entityId);
  const endDate = new Date();

  logger.info('Fetching emails from specific time', {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  const query = buildOrderQuery(startDate, endDate);
  logger.debug('Gmail query', { query });

  const rawResult = await entity.execute({
    actionName: "GMAIL_FETCH_EMAILS",
    params: {
      query,
      max_results: 100
    }
  });

  const response_data = rawResult.data?.response_data as EmailResponse;
  if (!response_data?.messages) {
    return [];
  }

  return response_data.messages;
}


