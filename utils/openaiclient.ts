import OpenAI from 'openai';
import { logger } from './logger';

class OpenAIClient {
  private static instance: OpenAI | null = null;

  private constructor() {}

  public static getInstance(): OpenAI {
    if (!OpenAIClient.instance) {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        const error = new Error('OPENAI_API_KEY is not set');
        logger.error('OpenAI client initialization failed:', { error });
        throw error;
      }

      OpenAIClient.instance = new OpenAI({
        apiKey,
        organization: process.env.OPENAI_ORG_ID // optional
      });

      logger.info('OpenAI client initialized');
    }

    return OpenAIClient.instance;
  }
}

export const openai = OpenAIClient.getInstance(); 