import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getUserLastSynced, getUserMail, getUserMetadata, updateUserLastSynced } from '@/utils/supabaseuser';
import { getEntityIdFromEmail } from '@/utils/composio';
import { fetchEmailFromLastMonth } from '@/utils/composio/gmail';
import { filterOrderRelatedEmails } from '@/utils/emailai';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function processEmails(entityId: string) {
  const emails = await fetchEmailFromLastMonth(entityId);
  logger.info('Emails fetched', { count: emails.length });

  const { relevantEmails } = await filterOrderRelatedEmails(emails);
  logger.info('Found order-related emails', { count: relevantEmails.length });

  return relevantEmails;
}

async function shouldSync(lastSynced: string | null): Promise<boolean> {
  if (!lastSynced) return true;
  
  const timeSinceLastSync = new Date().getTime() - new Date(lastSynced).getTime();
  return timeSinceLastSync > SYNC_INTERVAL;
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.setRequestId(requestId);

  try {
    const { last_synced } = await getUserLastSynced();
    const needsSync = await shouldSync(last_synced);

    logger.info('Processing order request', {
      lastSynced: last_synced,
      needsSync
    });

    if (!needsSync) {
      logger.info('Sync not needed', { 
        lastSynced: last_synced, 
        nextSyncIn: SYNC_INTERVAL - (new Date().getTime() - new Date(last_synced).getTime()) 
      });
      return NextResponse.json({
        success: true,
        message: `Last synced: ${new Date(last_synced).toISOString()}`,
        needsSync: false,
        data: {
          relevantEmails: [],
          orderDetails: []
        }
      });
    }

    const userMail = await getUserMail();
    if (!userMail) {
      logger.error('No user email found');
      return NextResponse.json(
        { 
          success: false,
          error: 'User not authenticated',
          message: 'Please log in to view orders'
        },
        { status: 401 }
      );
    }

    const entityId = getEntityIdFromEmail(userMail);
    logger.info('Starting email sync', { 
      userMail,
      entityId,
      isInitialSync: !last_synced 
    });

    try {
      const emails = await fetchEmailFromLastMonth(entityId);
      logger.info('Emails fetched', { count: emails.length });

      const { relevantEmails, orderDetails } = await filterOrderRelatedEmails(emails);
      logger.info('Order processing complete', {
        relevantEmailsCount: relevantEmails.length,
        orderDetailsCount: orderDetails.length
      });

      await updateUserLastSynced(new Date().toISOString());

      return NextResponse.json({
        success: true,
        message: "Sync completed successfully",
        data: {
          relevantEmails,
          orderDetails
        }
      });
    } catch (syncError) {
      logger.error('Error during email sync:', { 
        error: syncError instanceof Error ? {
          message: syncError.message,
          stack: syncError.stack
        } : 'Unknown error'
      });
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Sync failed',
          message: 'Failed to sync emails. Please try again.'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    logger.error('Error in order sync:', { 
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : 'Unknown error'
    });

    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 