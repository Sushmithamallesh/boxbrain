import { getSupabaseClient } from './supabase/server';
import { OrderDetails, OrderStatus, ReturnStatus } from '@/components/fetchorders';
import { logger } from './logger';

// Add this helper function at the top
function parseDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  
  try {
    // If it's already a Date object
    if (dateStr instanceof Date) {
      return isNaN(dateStr.getTime()) ? null : dateStr;
    }
    
    // Try parsing ISO string
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  } catch (error) {
    return null;
  }
}

// Validation function
function validateOrder(order: OrderDetails): { isValid: boolean; error?: string } {
  if (!order.orderId) {
    return { isValid: false, error: 'Order ID is required' };
  }
  if (!order.vendor) {
    return { isValid: false, error: 'Vendor is required' };
  }
  if (typeof order.totalAmount !== 'number') {
    return { isValid: false, error: 'Total amount must be a number' };
  }
  if (!order.emailReceivedTime || !parseDate(order.emailReceivedTime)) {
    return { isValid: false, error: 'Valid email received time is required' };
  }
  if (!order.latestStatus) {
    return { isValid: false, error: 'Latest status is required' };
  }
  if (!order.senderEmail) {
    return { isValid: false, error: 'Sender email is required' };
  }
  return { isValid: true };
}

// Validate timestamps in status history
function validateStatusHistory(history: OrderDetails['statusHistory']): { isValid: boolean; error?: string } {
  if (!history?.length) return { isValid: true };

  for (const entry of history) {
    if (!entry.timestamp || !parseDate(entry.timestamp)) {
      return { isValid: false, error: 'Valid timestamp is required for status history' };
    }
    if (!entry.emailId) {
      return { isValid: false, error: 'Email ID is required for status history' };
    }
  }

  return { isValid: true };
}

export async function storeOrderDetails(orderDetails: OrderDetails[], userId: string) {
  const supabase = await getSupabaseClient();

  try {
    let hasErrors = false;
    const errors: Array<{
      orderId: string;
      error: Error | { code?: string; message?: string };
      context?: string;
    }> = [];

    for (const order of orderDetails) {
      try {
        // Validate order data
        const validation = validateOrder(order);
        if (!validation.isValid) {
          const error = new Error(validation.error);
          logger.error('Order validation failed:', { 
            error: error.message, 
            orderId: order.orderId,
            orderData: order
          });
          errors.push({ orderId: order.orderId, error, context: 'validation' });
          hasErrors = true;
          continue;
        }

        // Validate status history
        const historyValidation = validateStatusHistory(order.statusHistory);
        if (!historyValidation.isValid) {
          const error = new Error(historyValidation.error);
          logger.error('Status history validation failed:', { 
            error: error.message, 
            orderId: order.orderId,
            statusHistory: order.statusHistory
          });
          errors.push({ orderId: order.orderId, error, context: 'status_history_validation' });
          hasErrors = true;
          continue;
        }

        // Validate and set default order date if needed
        const parsedEmailTime = parseDate(order.emailReceivedTime);
        const parsedOrderDate = parseDate(order.orderDate);
        
        if (!parsedEmailTime) {
          logger.error('Invalid email received time:', { 
            orderId: order.orderId,
            emailReceivedTime: order.emailReceivedTime
          });
          errors.push({ 
            orderId: order.orderId, 
            error: new Error('Invalid email received time'), 
            context: 'date_parsing'
          });
          hasErrors = true;
          continue;
        }

        const orderDate = parsedOrderDate || parsedEmailTime;
        
        logger.debug('Processing order with dates:', {
          orderId: order.orderId,
          orderDate: orderDate.toISOString(),
          emailReceivedTime: parsedEmailTime.toISOString(),
          originalOrderDate: order.orderDate,
          originalEmailTime: order.emailReceivedTime
        });

        // First, check if order exists
        const { data: existingOrder, error: fetchError } = await supabase
          .from('orders')
          .select('id, latest_status, email_received_time')
          .eq('user_id', userId)
          .eq('order_id', order.orderId)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found" error
          logger.error('Error fetching existing order:', { error: fetchError, orderId: order.orderId });
          errors.push({ orderId: order.orderId, error: fetchError });
          hasErrors = true;
          continue;
        }

        if (existingOrder) {
          const newEmailTime = parsedEmailTime;
          const existingEmailTime = parseDate(existingOrder.email_received_time);
          
          if (!existingEmailTime) {
            logger.error('Invalid existing email time in database:', {
              orderId: order.orderId,
              existingEmailTime: existingOrder.email_received_time
            });
            errors.push({ 
              orderId: order.orderId, 
              error: new Error('Invalid existing email time in database'), 
              context: 'date_comparison'
            });
            hasErrors = true;
            continue;
          }

          // If new email is more recent, update order and move current status to history
          if (newEmailTime > existingEmailTime) {
            logger.info('New email is more recent, updating order and preserving history:', {
              orderId: order.orderId,
              oldStatus: existingOrder.latest_status,
              newStatus: order.latestStatus
            });

            // Move current order status to history
            const { error: historyError } = await supabase
              .from('order_status_history')
              .insert({
                order_id: existingOrder.id,
                status: existingOrder.latest_status,
                timestamp: existingEmailTime,
                email_id: `existing_${existingEmailTime.getTime()}` // Generate unique ID for existing status
              });

            if (historyError) {
              logger.error('Error preserving existing status in history:', { error: historyError, orderId: order.orderId });
              errors.push({ orderId: order.orderId, error: historyError });
              hasErrors = true;
              continue;
            }

            // Update order with new information
            const { data: orderData, error: orderError } = await supabase
              .from('orders')
              .update({
                vendor: order.vendor,
                total_amount: order.totalAmount,
                currency: order.currency,
                order_date: orderDate,
                latest_status: order.latestStatus,
                tracking_url: order.trackingUrl,
                email_received_time: order.emailReceivedTime,
                sender_email: order.senderEmail
              })
              .eq('id', existingOrder.id)
              .select()
              .single();

            if (orderError) {
              logger.error('Error updating order:', { error: orderError, orderId: order.orderId });
              errors.push({ orderId: order.orderId, error: orderError });
              hasErrors = true;
              continue;
            }

            // Add new status to history
            if (order.statusHistory?.length > 0) {
              const { error: newHistoryError } = await supabase
                .from('order_status_history')
                .insert(
                  order.statusHistory.map(history => ({
                    order_id: existingOrder.id,
                    status: history.status,
                    timestamp: history.timestamp,
                    email_id: history.emailId
                  }))
                );

              if (newHistoryError) {
                logger.error('Error adding new status history:', { error: newHistoryError, orderId: order.orderId });
                errors.push({ orderId: order.orderId, error: newHistoryError });
                hasErrors = true;
              }
            }

            // Update return information if exists
            if (order.return) {
              const { error: returnError } = await supabase
                .from('order_returns')
                .upsert({
                  order_id: existingOrder.id,
                  initiated_date: order.return.initiatedDate,
                  tracking_url: order.return.trackingUrl,
                  status: order.return.status
                });

              if (returnError) {
                logger.error('Error updating return info:', { error: returnError, orderId: order.orderId });
                errors.push({ orderId: order.orderId, error: returnError });
                hasErrors = true;
              }
            }
          } else {
            // If new email is older, just add status to history
            logger.info('New email is older, preserving current order and adding to history:', {
              orderId: order.orderId,
              newStatus: order.latestStatus
            });

            if (order.statusHistory?.length > 0) {
              const { error: historyError } = await supabase
                .from('order_status_history')
                .insert(
                  order.statusHistory.map(history => ({
                    order_id: existingOrder.id,
                    status: history.status,
                    timestamp: history.timestamp,
                    email_id: history.emailId
                  }))
                );

              if (historyError) {
                logger.error('Error adding historical status:', { error: historyError, orderId: order.orderId });
                errors.push({ orderId: order.orderId, error: historyError });
                hasErrors = true;
              }
            }
          }
        } else {
          // Create new order with initial status
          logger.info('Creating new order:', { 
            orderId: order.orderId,
            orderDate: orderDate.toISOString()
          });
          
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .insert({
              user_id: userId,
              order_id: order.orderId,
              vendor: order.vendor,
              total_amount: order.totalAmount,
              currency: order.currency || 'USD', // Default to USD if not specified
              order_date: orderDate,
              latest_status: order.latestStatus,
              tracking_url: order.trackingUrl,
              email_received_time: order.emailReceivedTime,
              sender_email: order.senderEmail
            })
            .select()
            .single();

          if (orderError) {
            logger.error('Error creating new order:', { 
              error: orderError, 
              orderId: order.orderId,
              orderDetails: {
                vendor: order.vendor,
                totalAmount: order.totalAmount,
                currency: order.currency,
                orderDate: orderDate,
                latestStatus: order.latestStatus,
                emailReceivedTime: order.emailReceivedTime
              }
            });
            errors.push({ orderId: order.orderId, error: orderError });
            hasErrors = true;
            continue;
          }

          // Add initial status to history
          if (order.statusHistory?.length > 0) {
            const { error: historyError } = await supabase
              .from('order_status_history')
              .insert(
                order.statusHistory.map(history => ({
                  order_id: orderData.id,
                  status: history.status,
                  timestamp: history.timestamp,
                  email_id: history.emailId
                }))
              );

            if (historyError) {
              logger.error('Error adding initial status history:', { error: historyError, orderId: order.orderId });
              errors.push({ orderId: order.orderId, error: historyError });
              hasErrors = true;
            }
          }

          // Add return information if exists
          if (order.return) {
            const { error: returnError } = await supabase
              .from('order_returns')
              .insert({
                order_id: orderData.id,
                initiated_date: order.return.initiatedDate,
                tracking_url: order.return.trackingUrl,
                status: order.return.status
              });

            if (returnError) {
              logger.error('Error adding return info:', { error: returnError, orderId: order.orderId });
              errors.push({ orderId: order.orderId, error: returnError });
              hasErrors = true;
            }
          }
        }
      } catch (orderError) {
        const error = orderError instanceof Error ? orderError : new Error('Unknown error processing order');
        logger.error('Error processing individual order:', { 
          error: {
            message: error.message,
            stack: error.stack,
            ...(orderError as any)
          }, 
          orderId: order.orderId,
          orderData: order
        });
        errors.push({ 
          orderId: order.orderId, 
          error,
          context: 'processing'
        });
        hasErrors = true;
      }
    }

    if (hasErrors) {
      const errorSummary = errors.map(e => ({
        orderId: e.orderId,
        error: e.error instanceof Error ? e.error.message : e.error.message || 'Unknown error',
        context: e.context
      }));
      
      logger.error('Failed to process some orders:', { 
        errorCount: errors.length,
        errors: errorSummary
      });
      
      return { 
        success: false, 
        error: new Error(`Failed to process ${errors.length} orders`), 
        errors: errorSummary
      };
    }

    return { success: true };
  } catch (error) {
    const finalError = error instanceof Error ? error : new Error('Unknown error in storeOrderDetails');
    logger.error('Error in storeOrderDetails:', { 
      error: {
        message: finalError.message,
        stack: finalError.stack,
        ...(error as any)
      }
    });
    return { success: false, error: finalError };
  }
} 