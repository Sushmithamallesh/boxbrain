import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getUserMail, getUserMetadata, updateUserLastSynced } from '@/utils/utils';
import { getEntityIdFromEmail } from '@/utils/composio';
import { fetchEmailFromLastMonth } from '@/utils/composio/gmail';

export async function GET(req: NextRequest) {
  try {
    const { last_synced } = await getUserMetadata();
    const userMail = await getUserMail();
    const entityId = getEntityIdFromEmail(userMail);

    if (!last_synced) {
        try {
            logger.info('First time sync, fetching emails from last month');
            const emails = await fetchEmailFromLastMonth(entityId);
            logger.info('Emails fetched successfully', { count: emails.length });
            
            // TODO: Process emails and extract order information
            // TODO: Store orders in database
            
            // Update last sync time
            //await updateUserLastSynced(new Date().toISOString());
        } catch (error) {
            logger.error('Failed to fetch emails:', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    } else {
        // Check if we need to sync again
        const timeSinceLastSync = new Date().getTime() - new Date(last_synced).getTime();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (timeSinceLastSync > fiveMinutes) {
            logger.info('Last sync was more than 5 minutes ago, syncing again');
            // TODO: Implement incremental sync logic
            await updateUserLastSynced(new Date().toISOString());
        }
    }

    // For now, return dummy data
    // TODO: Implement actual order fetching from database
    const orders = [
      {
        id: '1',
        orderNumber: 'ORD-001',
        status: 'In Transit',
        carrier: 'UPS',
        trackingNumber: '1Z999AA1234567890',
        estimatedDelivery: '2024-02-20'
      },
      {
        id: '2',
        orderNumber: 'ORD-002',
        status: 'Delivered',
        carrier: 'FedEx',
        trackingNumber: '794583957364',
        estimatedDelivery: '2024-02-18'
      }
    ];

    return NextResponse.json({
      success: true,
      orders,
      message: last_synced 
        ? `last synced: ${new Date(last_synced).toLocaleString()}`
        : 'initial sync in progress...'
    });

  } catch (error) {
    const err = error as Error;
    logger.error('Failed to fetch orders:', { 
      message: err.message,
      stack: err.stack 
    });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 