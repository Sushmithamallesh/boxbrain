import { EmailMessage } from "./composio/types";
import { openai } from "./openaiclient";
import { logger } from "./logger";

interface RelevantEmail {
  subject: string;
  messageId: string;
  messageTimestamp: string;
}

interface FilterEmailsResult {
  relevantEmails: RelevantEmail[];
  orderDetails: OrderDetails[];
}

enum OrderStatus {
  ORDERED = 'ordered',
  CONFIRMED = 'confirmed',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  PAYMENT_FAILED = 'payment_failed'
}

enum ReturnStatus {
  INITIATED = 'initiated',
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKED_UP = 'picked_up',
  RECEIVED = 'received',
  REFUNDED = 'refunded'
}

interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  emailId: string;
}

interface ReturnInfo {
  initiatedDate?: Date;
  trackingUrl?: string;
  status: ReturnStatus;
}

interface OrderDetails {
  orderId: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  orderDate: Date;
  latestStatus: OrderStatus;
  trackingUrl?: string;
  emailReceivedTime: string;
  senderEmail: string;
  statusHistory: OrderStatusHistory[];
  return?: ReturnInfo;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function extractOrderDetails(email: EmailMessage): Promise<OrderDetails | null> {
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert at analyzing emails to extract order information. 
            Extract the following details in JSON format:
            - orderId: The unique order/confirmation number assigned by the vendor (REQUIRED). This is different from transaction/payment IDs.
              * Do NOT use payment/transaction IDs (e.g. "TXN123", "PAY789", etc.)
              * If no clear order ID is found (only transaction ID exists), return "" STRING.
            - vendor: Company name
            - totalAmount: Purchase amount (number)
            - currency: Currency code (e.g., USD, EUR, GBP)
            - orderDate: When order was placed (ISO date string)
            - latestStatus: Current order status (one of: ordered, confirmed, packed, shipped, out_for_delivery, delivered, payment_failed)
            - trackingUrl: Tracking link if available
            - statusHistory: Array of status changes with timestamps and emailId
            - return: Return information if applicable (initiatedDate, trackingUrl, status)
            
            If you can't find certain information, omit those fields.
            For currency, default to "USD" if not explicitly mentioned.
            If the email is not order-related, you can't extract meaningful information, or there is no order ID, return null.
            For payment_failed status, still require a valid order ID to process the order.
            Ensure all dates are in ISO format and amounts are numbers.`
          },
          {
            role: "user",
            content: JSON.stringify({
              subject: email.preview.subject,
              body: email.messageText,
              sender: email.sender,
              timestamp: email.messageTimestamp
            })
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      const parsedResponse = JSON.parse(response);
      if (!parsedResponse || parsedResponse.orderId === "") {
        logger.info('Email not relevant for order details', {
          subject: email.preview.subject,
          messageId: email.messageId
        });
        return null;
      }

      // Add the email metadata
      const orderDetails: OrderDetails = {
        ...parsedResponse,
        currency: parsedResponse.currency || 'USD', // Default to USD if not provided
        emailReceivedTime: email.messageTimestamp,
        senderEmail: email.sender,
        // Convert date strings to Date objects
        orderDate: new Date(parsedResponse.orderDate),
        statusHistory: parsedResponse.statusHistory?.map((history: any) => ({
          ...history,
          timestamp: new Date(history.timestamp)
        })) || [],
        return: parsedResponse.return ? {
          ...parsedResponse.return,
          initiatedDate: parsedResponse.return.initiatedDate ? new Date(parsedResponse.return.initiatedDate) : undefined
        } : undefined
      };

      logger.info('Successfully extracted order details', {
        messageId: email.messageId,
        orderId: orderDetails.orderId,
        vendor: orderDetails.vendor,
        currency: orderDetails.currency
      });

      return orderDetails;

    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        logger.error('Max retries reached in order extraction', {
          error,
          messageId: email.messageId
        });
        return null;
      }
      logger.warn('Retrying order extraction', {
        attempt: retries,
        error: error instanceof Error ? error.message : 'Unknown error',
        messageId: email.messageId
      });
      await sleep(RETRY_DELAY * retries);
    }
  }

  return null;
}

export async function filterOrderRelatedEmails(emails: EmailMessage[]): Promise<FilterEmailsResult> {
  const relevantEmails: RelevantEmail[] = [];
  const orderDetails: OrderDetails[] = [];
  const processedOrderIds = new Set<string>();
  let retries = 0;
  
  while (retries < MAX_RETRIES) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Analyze emails to identify order-related content (purchases, shipping, returns, e-commerce). Respond with a JSON object where keys are 'email_X' (X=index) and values are boolean."
          },
          {
            role: "user",
            content: JSON.stringify(emails.map(email => ({
              subject: email.preview.subject,
              sender: email.sender
            })))
          }
        ],
        temperature: 0,
        response_format: { type: "json_object" }
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error('Empty response from OpenAI');
      }

      const jsonResponse = JSON.parse(response);
      if (!jsonResponse || typeof jsonResponse !== 'object') {
        throw new Error('Invalid response format from OpenAI');
      }

      const results = emails.map((_, index) => jsonResponse[`email_${index}`] === true);

      // Get relevant emails first
      const relevantEmailsData = emails.filter((_, index) => results[index]);
      relevantEmails.push(...relevantEmailsData.map(email => ({
        subject: email.preview.subject,
        messageId: email.messageId,
        messageTimestamp: email.messageTimestamp
      })));

      // Process order details in parallel batches
      const BATCH_SIZE = 3; // Process 3 emails at a time to avoid rate limits
      for (let i = 0; i < relevantEmailsData.length; i += BATCH_SIZE) {
        const batch = relevantEmailsData.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(email => extractOrderDetails(email))
        );
        
        // Filter out null results and duplicates, then add valid order details
        const validResults = batchResults.filter((result): result is OrderDetails => {
          if (!result) return false;
          if (processedOrderIds.has(result.orderId)) {
            logger.info('Ignoring duplicate order ID', {
              orderId: result.orderId,
              vendor: result.vendor
            });
            return false;
          }
          processedOrderIds.add(result.orderId);
          return true;
        });
        
        orderDetails.push(...validResults);

        // Add a small delay between batches to avoid rate limits
        if (i + BATCH_SIZE < relevantEmailsData.length) {
          await sleep(1000);
        }
      }

      logger.info('Email processing completed', { 
        totalProcessed: emails.length,
        relevantFound: relevantEmails.length,
        ordersExtracted: orderDetails.length,
        duplicatesSkipped: processedOrderIds.size - orderDetails.length
      });

      return { relevantEmails, orderDetails };

    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        logger.error('Max retries reached in email filtering', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          attempt: retries
        });
        throw error;
      }
      logger.warn('Retrying email filtering', { 
        attempt: retries, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      await sleep(RETRY_DELAY * retries);
    }
  }

  return { relevantEmails, orderDetails };
}
        