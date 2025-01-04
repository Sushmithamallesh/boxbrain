import { EmailMessage } from "../composio/types";
import { openai } from "../openaiclient";
import { logger } from "../logger";
import type { OrderDetails, OrderStatus, ReturnStatus } from "@/types/orders";

export interface RelevantEmail {
  subject: string;
  messageId: string;
  messageTimestamp: string;
}

export interface FilterEmailsResult {
  relevantEmails: RelevantEmail[];
  orderDetails: OrderDetails[];
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
            content: `You are an expert at analyzing e-commerce emails to extract detailed order information.

Extract order details in JSON format with the following structure:

Required Fields:
- orderId (string): Unique order/confirmation number from vendor
  * Must be an actual order ID (e.g., "ORD-123", "AMZ-456")
  * Do NOT use payment/transaction IDs (e.g., "TXN123", "PAY789")
  * Return empty string if no valid order ID found
- vendor (string): Company name/store that processed the order
- totalAmount (number): Total purchase amount (excluding shipping if separately listed)
- orderDate (string): ISO date when order was placed
- latestStatus (string): Current order status, one of:
  * 'ordered': Initial order confirmation
  * 'processing': Order being prepared
  * 'shipped': Order in transit
  * 'delivered': Order received by customer
  * 'cancelled': Order cancelled
  * 'returned': Return processed

Optional Fields:
- currency (string): Currency code (USD, EUR, etc.). Default: "USD"
- trackingUrl (string): Full URL for order tracking
- metadata (object): Additional order details like:
  * itemCount: Number of items
  * shippingCost: Shipping fee
  * taxAmount: Tax charged
  * estimatedDelivery: Expected delivery date
  * paymentMethod: Payment method used
  * shippingAddress: Delivery address
  * items: Array of purchased items

Status History:
- statusHistory (array): Status changes with:
  * status: One of the valid status values
  * timestamp: ISO date string
  * emailId: Unique identifier for the email

Return Information (if applicable):
- return (object):
  * initiatedDate: ISO date when return started
  * trackingUrl: Return shipment tracking URL
  * status: One of:
    - 'initiated': Return requested
    - 'return_label_created': Label generated
    - 'in_transit': Return shipment in progress
    - 'received': Return received by vendor
    - 'refunded': Refund processed

Guidelines:
1. Parse dates in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)
2. Convert all amounts to numbers (remove currency symbols)
3. Extract tracking URLs only if they are complete and valid
4. Include metadata for any additional useful information
5. Return null if:
   - Email is not order-related
   - No valid order ID found
   - Cannot extract meaningful information
6. For order status:
   - Use most specific status available
   - Consider email context and timing
   - Track status changes in statusHistory`
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
            content: `You are an expert at identifying e-commerce and order-related emails.

Analyze each email to determine if it's related to:
1. Order confirmations/receipts
2. Shipping notifications
3. Delivery updates
4. Order status changes
5. Return/refund processes
6. Order cancellations
7. Payment confirmations for orders

Key Indicators:
- Sender domains from known e-commerce platforms
- Order/tracking number patterns
- E-commerce related keywords
- Shipping/delivery terminology
- Transaction confirmation language

Exclude:
- Marketing/promotional emails
- Newsletters
- Account notifications
- Password resets
- General updates
- Wishlist notifications
- Shopping cart reminders

Respond with a JSON object where:
- Keys are 'email_X' (X = index number)
- Values are boolean (true = order-related, false = not order-related)

Example:
{
  "email_0": true,   // Order confirmation
  "email_1": false,  // Marketing newsletter
  "email_2": true    // Shipping update
}`
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
        