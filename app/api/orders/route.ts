import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getUserLastSynced, getUserMail, updateUserLastSynced } from '@/utils/supabase/supabaseuser';
import { getEntityIdFromEmail } from '@/utils/composio/entitymanagement';
import { fetchEmailFromLastMonth, fetchEmailFromTime } from '@/utils/composio/gmail';
import { filterOrderRelatedEmails, type RelevantEmail } from '@/utils/orders/orderfilterandextract';
import { storeOrderDetails } from '@/utils/orders/database';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import type { OrdersResponse } from '@/types/orders';
import { fetchUserOrders } from '@/utils/orders/fetchOrderDetails';
import { EmailMessage } from '@/utils/composio/types';
const SYNC_INTERVAL = 1 * 60 * 1000; // 10 minutes in milliseconds

async function shouldSync(lastSynced: string | null): Promise<boolean> {
  if (!lastSynced) return true;
  const timeSinceLastSync = new Date().getTime() - new Date(lastSynced).getTime();
  return timeSinceLastSync > SYNC_INTERVAL;
}

export async function GET(req: NextRequest): Promise<NextResponse<OrdersResponse>> {
  try {
    const supabase = await createServerSupabaseClient();
    // Check if sync is needed
    const { last_synced } = await getUserLastSynced();
    logger.info('Last synced from metadata:', { last_synced });
    const needsSync = await shouldSync(last_synced);
    logger.info('Do we need to sync?', { needsSync });
    if (!needsSync) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.id) {
        return NextResponse.json(
          { 
            success: false, 
            message: 'Authentication failed',
            needsSync: false,
            data: { relevantEmails: [], orderDetails: [] }
          },
          { status: 401 }
        );
      }

      const orderDetails = await fetchUserOrders(user.id);
      return NextResponse.json({
        success: true,
        message: `Last synced: ${new Date(last_synced).toISOString()}`,
        needsSync: false,
        data: { relevantEmails: [], orderDetails }
      });
    }

    // Get user email
    const userMail = await getUserMail();
    if (!userMail) {
      return NextResponse.json(
        { 
          success: false, 
          message: 'Please log in to view orders',
          needsSync: false,
          data: { relevantEmails: [], orderDetails: [] }
        },
        { status: 401 }
      );
    }
    // Get user ID
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user?.id) {
      logger.error('Failed to get user:', { error: userError });
      return NextResponse.json(
        { 
          success: false, 
          message: 'Authentication failed',
          needsSync: false,
          data: { relevantEmails: [], orderDetails: [] }
        },
        { status: 401 }
      );
    }

    // Fetch and process emails
    const entityId = getEntityIdFromEmail(userMail);
    var emails: EmailMessage[] = [];
    if (!last_synced) {
        emails = await fetchEmailFromLastMonth(entityId);
    } else {
        logger.info('Fetching emails from time', { last_synced });
        emails = await fetchEmailFromTime(entityId, new Date(last_synced));
        logger.info('Emails fetched', { count: emails.length });
    }

    
    if (!emails.length) {
      logger.info('No emails found for processing');
      return NextResponse.json({
        success: true,
        message: 'No new emails to process',
        needsSync: true,
        data: { relevantEmails: [], orderDetails: [] }
      });
    }

    const { relevantEmails, orderDetails } = await filterOrderRelatedEmails(emails);

    // Store orders in database
    if (orderDetails.length > 0) {
      const { success: storeSuccess, errors } = await storeOrderDetails(orderDetails, user.id);
      if (!storeSuccess) {
        logger.error('Failed to store some orders:', { errors });
        return NextResponse.json(
          { 
            success: false, 
            message: 'Failed to process some orders',
            needsSync: true,
            data: { relevantEmails, orderDetails: [] }
          },
          { status: 500 }
        );
      }
    }

    // Update last sync time
    await updateUserLastSynced(new Date().toISOString());

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      needsSync: true,
      data: { relevantEmails, orderDetails }
    });

  } catch (error) {
    logger.error('Error in order sync:', { 
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Failed to process orders',
        needsSync: true,
        data: { relevantEmails: [], orderDetails: [] }
      },
      { status: 500 }
    );
  }
} 