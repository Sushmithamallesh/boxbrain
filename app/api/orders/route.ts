import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getUserLastSynced, getUserMail, updateUserLastSynced } from '@/utils/supabaseuser';
import { getEntityIdFromEmail } from '@/utils/composio';
import { fetchEmailFromLastMonth } from '@/utils/composio/gmail';
import { filterOrderRelatedEmails } from '@/utils/emailai';
import { storeOrderDetails } from '@/utils/database';
import { getSupabaseClient } from '@/utils/supabase/server';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

async function shouldSync(lastSynced: string | null): Promise<boolean> {
  if (!lastSynced) return true;
  const timeSinceLastSync = new Date().getTime() - new Date(lastSynced).getTime();
  return timeSinceLastSync > SYNC_INTERVAL;
}

export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();
  logger.setRequestId(requestId);

  try {
    // Check if sync is needed
    const { last_synced } = await getUserLastSynced();
    const needsSync = await shouldSync(last_synced);

    if (!needsSync) {
      return NextResponse.json({
        success: true,
        message: `Last synced: ${new Date(last_synced).toISOString()}`,
        needsSync: false,
        data: { relevantEmails: [], orderDetails: [] }
      });
    }

    // Get user email
    const userMail = await getUserMail();
    if (!userMail) {
      return NextResponse.json(
        { success: false, message: 'Please log in to view orders' },
        { status: 401 }
      );
    }

    // Get user ID
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 401 }
      );
    }

    // Fetch and process emails
    const entityId = getEntityIdFromEmail(userMail);
    const emails = await fetchEmailFromLastMonth(entityId);
    const { relevantEmails, orderDetails } = await filterOrderRelatedEmails(emails);

    // Store orders in database
    const { success: storeSuccess, errors } = await storeOrderDetails(orderDetails, user.id);
    if (!storeSuccess) {
      logger.error('Failed to store some orders:', { errors });
      return NextResponse.json(
        { success: false, message: 'Failed to process some orders' },
        { status: 500 }
      );
    }

    // Update last sync time
    await updateUserLastSynced(new Date().toISOString());

    return NextResponse.json({
      success: true,
      message: "Sync completed successfully",
      data: { relevantEmails, orderDetails }
    });

  } catch (error) {
    logger.error('Error in order sync:', { error });
    return NextResponse.json(
      { success: false, message: 'Failed to process orders' },
      { status: 500 }
    );
  }
} 