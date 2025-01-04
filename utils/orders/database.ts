import { createServerSupabaseClient } from '../supabase/server';
import { OrderDetails, OrderStatus } from '@/types/orders';
import { logger } from '../logger';

function parseDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  try {
    const date = dateStr instanceof Date ? dateStr : new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

function isMoreRecentStatus(newStatus: OrderStatus, oldStatus: OrderStatus): boolean {
  const statusPriority: Record<OrderStatus, number> = {
    'ordered': 1,
    'processing': 2,
    'shipped': 3,
    'delivered': 4,
    'cancelled': 5,
    'returned': 6
  };
  return statusPriority[newStatus] > statusPriority[oldStatus];
}

function shouldUpdateOrder(newOrder: OrderDetails, existingOrder: any): boolean {
  const newEmailTime = parseDate(newOrder.emailReceivedTime);
  const existingEmailTime = parseDate(existingOrder.email_received_time);
  
  if (!newEmailTime || !existingEmailTime) return false;
  
  // Always update if email is more recent
  if (newEmailTime > existingEmailTime) return true;
  
  // If same email time, update if status is more recent
  if (newEmailTime.getTime() === existingEmailTime.getTime()) {
    return isMoreRecentStatus(newOrder.latestStatus, existingOrder.latest_status);
  }
  
  return false;
}

export async function storeOrderDetails(orderDetails: OrderDetails[], userId: string) {
  const supabase = await createServerSupabaseClient();
  const errors: Array<{ orderId: string; error: any }> = [];

  try {
    for (const order of orderDetails) {
      try {
        // Parse dates
        const parsedEmailTime = parseDate(order.emailReceivedTime);
        const orderDate = parseDate(order.orderDate) || parsedEmailTime;

        if (!parsedEmailTime || !orderDate) {
          logger.error('Invalid dates for order:', { 
            orderId: order.orderId,
            emailReceivedTime: order.emailReceivedTime,
            orderDate: order.orderDate
          });
          continue;
        }

        // Check if order exists
        const { data: existingOrder, error: fetchError } = await supabase
          .from('orders')
          .select('id, latest_status, email_received_time')
          .eq('user_id', userId)
          .eq('order_id', order.orderId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          logger.error('Error fetching order:', { error: fetchError, orderId: order.orderId });
          errors.push({ orderId: order.orderId, error: fetchError });
          continue;
        }

        if (existingOrder) {
          // Check if we should update the order
          if (shouldUpdateOrder(order, existingOrder)) {
            // Move current status to history
            await supabase
              .from('order_status_history')
              .insert({
                order_id: existingOrder.id,
                status: existingOrder.latest_status,
                timestamp: existingOrder.email_received_time,
                email_id: `existing_${new Date(existingOrder.email_received_time).getTime()}`
              });

            // Update order
            await supabase
              .from('orders')
              .update({
                vendor: order.vendor,
                total_amount: order.totalAmount,
                currency: order.currency || 'USD',
                order_date: orderDate,
                latest_status: order.latestStatus,
                tracking_url: order.trackingUrl,
                email_received_time: order.emailReceivedTime,
                sender_email: order.senderEmail,
                metadata: order.metadata
              })
              .eq('id', existingOrder.id);

            // Add new status history
            if (order.statusHistory?.length) {
              await supabase
                .from('order_status_history')
                .insert(
                  order.statusHistory.map(history => ({
                    order_id: existingOrder.id,
                    status: history.status,
                    timestamp: history.timestamp,
                    email_id: history.emailId
                  }))
                );
            }

            // Update return info if exists
            if (order.return) {
              await supabase
                .from('order_returns')
                .upsert({
                  order_id: existingOrder.id,
                  initiated_date: order.return.initiatedDate,
                  tracking_url: order.return.trackingUrl,
                  status: order.return.status
                });
            }
          } else {
            // If not updating order, just add new status history
            if (order.statusHistory?.length) {
              await supabase
                .from('order_status_history')
                .insert(
                  order.statusHistory.map(history => ({
                    order_id: existingOrder.id,
                    status: history.status,
                    timestamp: history.timestamp,
                    email_id: history.emailId
                  }))
                );
            }
          }
        } else {
          // Create new order
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: userId,
              order_id: order.orderId,
              vendor: order.vendor,
              total_amount: order.totalAmount,
              currency: order.currency || 'USD',
              order_date: orderDate,
              latest_status: order.latestStatus,
              tracking_url: order.trackingUrl,
              email_received_time: order.emailReceivedTime,
              sender_email: order.senderEmail,
              metadata: order.metadata
            })
            .select()
            .single();

          if (orderError) {
            logger.error('Error creating order:', { error: orderError, orderId: order.orderId });
            errors.push({ orderId: order.orderId, error: orderError });
            continue;
          }

          // Add initial status history
          if (order.statusHistory?.length) {
            await supabase
              .from('order_status_history')
              .insert(
                order.statusHistory.map(history => ({
                  order_id: orderData.id,
                  status: history.status,
                  timestamp: history.timestamp,
                  email_id: history.emailId
                }))
              );
          }

          // Add return info if exists
          if (order.return) {
            await supabase
              .from('order_returns')
              .insert({
                order_id: orderData.id,
                initiated_date: order.return.initiatedDate,
                tracking_url: order.return.trackingUrl,
                status: order.return.status
              });
            }
          }
        } catch (error) {
          logger.error('Error processing order:', { error, orderId: order.orderId });
          errors.push({ orderId: order.orderId, error });
        }
      }

      return { success: errors.length === 0, errors: errors.length ? errors : undefined };
    } catch (error) {
      logger.error('Error in storeOrderDetails:', { error });
      return { success: false, error };
    }
} 