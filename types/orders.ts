export type OrderStatus = 
  | 'ordered'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned';

export type ReturnStatus =
  | 'initiated'
  | 'return_label_created'
  | 'in_transit'
  | 'received'
  | 'refunded';

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: Date | string;
  emailId: string;
}

export interface OrderReturn {
  initiatedDate: Date | string;
  trackingUrl?: string;
  status: ReturnStatus;
}

export interface OrderDetails {
  orderId: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  orderDate: Date | string;
  latestStatus: OrderStatus;
  trackingUrl?: string;
  emailReceivedTime: Date | string;
  senderEmail: string;
  statusHistory?: OrderStatusHistory[];
  return?: OrderReturn;
  metadata?: Record<string, any>;
}

export interface OrdersResponse {
  success: boolean;
  message: string;
  data?: {
    relevantEmails: Array<{
      subject: string;
      messageId: string;
      messageTimestamp: string;
    }>;
    orderDetails: OrderDetails[];
  };
  needsSync?: boolean;
} 