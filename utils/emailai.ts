import { EmailMessage } from "./composio/types";
import { openai } from "./openaiclient";
import { logger } from "./logger";

interface RelevantEmail {
  subject: string;
  messageId: string;
}

interface FilterEmailsResult {
  relevantEmails: RelevantEmail[];
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function filterOrderRelatedEmails(emails: EmailMessage[]): Promise<FilterEmailsResult> {
  const relevantEmails: RelevantEmail[] = [];
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
      const results = emails.map((_, index) => jsonResponse[`email_${index}`] === true);

      emails.forEach((email, index) => {
        if (results[index]) {
          relevantEmails.push({
            subject: email.preview.subject,
            messageId: email.messageId
          });
        }
      });

      logger.info('Email filtering completed', { 
        totalProcessed: emails.length,
        relevantFound: relevantEmails.length
      });

      return { relevantEmails };

    } catch (error) {
      retries++;
      if (retries === MAX_RETRIES) {
        logger.error('Max retries reached in email filtering', { error });
        throw error;
      }
      logger.warn('Retrying email filtering', { 
        attempt: retries, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      await sleep(RETRY_DELAY * retries); // Exponential backoff
    }
  }

  return { relevantEmails };
}
        