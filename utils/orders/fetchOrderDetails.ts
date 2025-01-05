import { createServerSupabaseClient } from '@/utils/supabase/server';
import { logger } from '@/utils/logger';
import type { OrderDetails } from '@/types/orders';

export async function fetchUserOrders(userId: string): Promise<OrderDetails[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_id,
        user_id,
        vendor,
        total_amount,
        currency,
        order_date,
        latest_status,
        tracking_url,
        email_received_time,
        sender_email,
        metadata,
        status_history,
        return_info
      `)
      .eq('user_id', userId)
      .order('order_date', { ascending: false });

    if (error) {
      logger.error('Failed to fetch orders:', { error, userId });
      return [];
    }

    if (!orders?.length) {
      return [];
    }

    return orders.map(order => ({
      id: order.id,
      orderId: order.order_id,
      vendor: order.vendor,
      totalAmount: order.total_amount,
      currency: order.currency,
      orderDate: order.order_date,
      latestStatus: order.latest_status,
      trackingUrl: order.tracking_url,
      emailReceivedTime: order.email_received_time,
      senderEmail: order.sender_email,
      metadata: order.metadata,
      statusHistory: order.status_history || [],
      return: order.return_info ? {
        initiatedDate: order.return_info.initiated_date,
        trackingUrl: order.return_info.tracking_url,
        status: order.return_info.status
      } : undefined
    }));

  } catch (error) {
    logger.error('Error fetching orders:', { error, userId });
    return [];
  }
} 