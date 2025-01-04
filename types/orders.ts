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

export interface OrderDetails {
  orderId: string;
  vendor: string;
  totalAmount: number;
  currency: string;
  orderDate: Date;
  latestStatus: OrderStatus;
  trackingUrl?: string;
  emailReceivedTime: string;
  senderEmail: string;
  statusHistory: OrderStatusHistory[];
  return?: ReturnInfo;
}

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  emailId: string;
}

export interface ReturnInfo {
  initiatedDate?: Date;
  trackingUrl?: string;
  status: ReturnStatus;
}

export enum OrderStatus {
  ORDERED = 'ordered',
  CONFIRMED = 'confirmed',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  PAYMENT_FAILED = 'payment_failed',
  CANCELLED = 'cancelled'
}

export enum ReturnStatus {
  INITIATED = 'initiated',
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKED_UP = 'picked_up',
  RECEIVED = 'received',
  REFUNDED = 'refunded'
} 