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
            content: `You are an expert at analyzing e-commerce emails to extract detailed order information. Be precise and conservative in your extraction.

Extract order details in JSON format with the following structure:

REQUIRED FIELDS - Must be clearly present in email:
- orderId (string): Unique order/confirmation number
  ✓ VALID: "ORD-123", "AMZ-456-789", "#1234567"
  × INVALID: Transaction IDs, payment refs, tracking numbers
  * Return empty string if no clear order ID found
- vendor (string): Company name that processed the order
  ✓ Use official company name, not email domain
  ✓ Normalize common variations (e.g., "Amazon.com" -> "Amazon")
- totalAmount (number): Purchase amount
  ✓ Include only order total
  ✓ Exclude shipping unless bundled
  ✓ Remove currency symbols
  ✓ Convert to number (e.g., "₹1,499.00" -> 1499.00)
- orderDate (string): When order was placed
  ✓ Use email timestamp if order date not specified
  ✓ Must be ISO format
- latestStatus (string): Current status
  ✓ Must be one of:
    * 'ordered': Initial confirmation
    * 'processing': Being prepared
    * 'shipped': In transit
    * 'delivered': Received
    * 'cancelled': Cancelled
    * 'returned': Return processed
- currency (string): Currency code - REQUIRED, not optional
  ✓ Must be standard 3-letter code:
    * "INR" for Indian Rupees (₹)
    * "USD" for US Dollars ($)
    * "EUR" for Euros (€)
    * "GBP" for British Pounds (£)
  ✓ Look for:
    * Currency symbols (₹, $, €, £)
    * Currency codes in email
    * Store's location/domain (e.g., .in -> "INR")
  ✓ Default rules:
    * .in domain -> "INR"
    * .com domain with ₹ -> "INR"
    * $ without other context -> "USD"

OPTIONAL FIELDS - Include only if clearly present:
- trackingUrl (string): Full, valid tracking URL
  ✓ Must be complete URL, not just tracking number
  ✓ Verify URL format is valid
- metadata (object): Additional verified info
  ✓ itemCount: Total items ordered
  ✓ shippingCost: Separate shipping fee
  ✓ taxAmount: Tax charged
  ✓ estimatedDelivery: Expected delivery date
  ✓ paymentMethod: Payment type used
  ✓ shippingAddress: Delivery location
  ✓ items: Array of purchased items

STATUS HISTORY - Track all mentioned statuses:
- statusHistory (array):
  ✓ status: Valid status from above list
  ✓ timestamp: ISO date when status occurred
  ✓ emailId: Current email's ID

RETURN INFO - Only if explicitly mentioned:
- return (object):
  ✓ initiatedDate: When return started (ISO date)
  ✓ trackingUrl: Valid return tracking URL
  ✓ status: Must be one of:
    * 'initiated': Return requested
    * 'return_label_created': Label ready
    * 'in_transit': Return shipping
    * 'received': Vendor received
    * 'refunded': Refund processed

VALIDATION RULES:
1. Return null if:
   × No valid order ID found
   × Email is not clearly order-related
   × Cannot extract required fields
   × Uncertain about data accuracy
2. Dates must be ISO format
3. Numbers must be cleaned of currency symbols
4. URLs must be complete and valid
5. Status must match predefined values
6. Currency must be valid 3-letter code
7. Don't guess or infer missing data

ERROR PREVENTION:
- Verify order ID format before including
- Validate all dates are parseable
- Check URL formats are complete
- Ensure amounts are valid numbers
- Verify status values match allowed list
- Ensure currency code is standard 3-letter format
- Don't include uncertain or ambiguous data

EXAMPLE EXTRACTIONS:
1. Indian Store:
   "Total: ₹1,499.00"
   -> totalAmount: 1499.00, currency: "INR"

2. US Store:
   "Total: $19.99"
   -> totalAmount: 19.99, currency: "USD"

3. Mixed Format:
   "Amount: Rs. 2,999.00"
   -> totalAmount: 2999.00, currency: "INR"`
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
          messageId: email.messageId,
          sender: email.sender,
          reason: !parsedResponse ? 'No data extracted' : 'No valid order ID'
        });
        return null;
      }

      // Log extracted fields
      logger.info('Extracted order fields', {
        messageId: email.messageId,
        subject: email.preview.subject,
        orderId: parsedResponse.orderId,
        vendor: parsedResponse.vendor,
        status: parsedResponse.latestStatus,
        hasTracking: !!parsedResponse.trackingUrl,
        hasReturn: !!parsedResponse.return,
        metadata: parsedResponse.metadata || {}
      });

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

      logger.info('Successfully processed order', {
        messageId: email.messageId,
        orderId: orderDetails.orderId,
        vendor: orderDetails.vendor,
        amount: `${orderDetails.currency} ${orderDetails.totalAmount}`,
        status: orderDetails.latestStatus,
        orderDate: (orderDetails.orderDate instanceof Date ? orderDetails.orderDate : new Date(orderDetails.orderDate)).toISOString(),
        hasTracking: !!orderDetails.trackingUrl,
        hasReturn: !!orderDetails.return,
        metadataFields: Object.keys(orderDetails.metadata || {})
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
            content: `You are an expert at identifying e-commerce and order-related emails. Your task is to identify ALL emails related to an order's lifecycle.

THESE ARE DEFINITELY ORDER EMAILS (mark as true):
1. Order Status Emails:
   ✓ Order confirmations ("Your order is confirmed", "Order received")
   ✓ Order cancellations ("Your order was cancelled", "Order cancelled")
   ✓ Shipping updates ("Order has been shipped", "Delivery update")
   ✓ Delivery confirmations
   ✓ Return confirmations
   ✓ Refund notifications

2. Payment Status Emails:
   ✓ Payment success ("Order is successful", "Payment confirmed")
   ✓ Payment failure ("Order unsuccessful", "Payment failed")
   ✓ Payment retry requests ("Please try again", "Payment pending")
   ✓ Payment confirmation from processors (PayU, Razorpay, etc.)

3. Common Legitimate Senders:
   ✓ Store domains (uniqlo.com, amazon.com)
   ✓ Payment processors (payu.in, razorpay.com)
   ✓ Order notification emails (orders@, noreply@)
   ✓ Store name with order domains

REAL EXAMPLES TO MARK AS TRUE:
✓ "Your Order at https://www.uniqlo.com/in/ is successful" from payment-report@payu.in
✓ "Your Order at https://www.uniqlo.com/in/ is unsuccessful, Please try again" from payment-report@payu.in
✓ "＜UNIQLO India＞ Your order was received" from order@mail.in.uniqlo.com
✓ "＜UNIQLO India＞ Your order was cancelled" from order@mail.in.uniqlo.com
✓ "＜UNIQLO India＞ Your order has been shipped" from order@mail.in.uniqlo.com
✓ "Your Keychron order is now complete" from noreply@keychron.in

THESE ARE NOT ORDER EMAILS (mark as false):
× Marketing emails ("Check out our sale")
× Cart abandonment ("Items in your cart")
× Wishlist updates
× Account-related emails (password reset)
× General newsletters
× Email system notifications (delivery failure)
× General shipping policy updates

Respond with a JSON object where:
- Keys are 'email_X' (X = index number)
- Values are boolean (true for ANY email related to order lifecycle)

Example responses:
{
  "email_0": true,    // "Payment successful for order"
  "email_1": true,    // "Payment failed, please retry"
  "email_2": true,    // "Order cancelled"
  "email_3": true,    // "Order shipped"
  "email_4": false,   // "Email delivery failed"
  "email_5": false    // "Check out our sale"
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

      // Log filtering results
      emails.forEach((email, index) => {
        const isRelevant = results[index];
        logger.info(`Email ${isRelevant ? 'RELEVANT' : 'FILTERED OUT'}`, {
          subject: email.preview.subject,
          sender: email.sender,
          messageId: email.messageId,
          timestamp: email.messageTimestamp,
          reason: isRelevant ? 'Matched order criteria' : 'Not order-related'
        });
      });

      // Get relevant emails first
      const relevantEmailsData = emails.filter((_, index) => results[index]);
      relevantEmails.push(...relevantEmailsData.map(email => ({
        subject: email.preview.subject,
        messageId: email.messageId,
        messageTimestamp: email.messageTimestamp
      })));

      // Log summary
      logger.info('Email filtering summary', {
        total: emails.length,
        relevant: relevantEmails.length,
        filtered: emails.length - relevantEmails.length,
        relevantSubjects: relevantEmails.map(e => e.subject)
      });

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
        