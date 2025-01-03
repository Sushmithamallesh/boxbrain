'use client';

import { useEffect, useState } from 'react';

// Types
interface OrdersResponse {
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

interface OrderDetails {
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

interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  emailId: string;
}

interface ReturnInfo {
  initiatedDate?: Date;
  trackingUrl?: string;
  status: ReturnStatus;
}

enum OrderStatus {
  ORDERED = 'ordered',
  CONFIRMED = 'confirmed',
  PACKED = 'packed',
  SHIPPED = 'shipped',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  PAYMENT_FAILED = 'payment_failed'
}

enum ReturnStatus {
  INITIATED = 'initiated',
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKED_UP = 'picked_up',
  RECEIVED = 'received',
  REFUNDED = 'refunded'
}

// Utility functions
const formatDate = (date: Date | string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(new Date(date));
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    currencyDisplay: 'narrowSymbol'
  }).format(amount);
};

const getStatusColor = (status: OrderStatus): string => {
  switch (status) {
    case OrderStatus.DELIVERED:
      return 'text-green-600';
    case OrderStatus.SHIPPED:
    case OrderStatus.OUT_FOR_DELIVERY:
      return 'text-blue-600';
    case OrderStatus.ORDERED:
    case OrderStatus.CONFIRMED:
      return 'text-yellow-600';
    case OrderStatus.PAYMENT_FAILED:
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

const formatStatusText = (status: OrderStatus): string => {
  return status.toString().toLowerCase().replace(/_/g, ' ');
};

// Components
const OrderCard = ({ order }: { order: OrderDetails }) => (
  <div className="flex flex-col gap-2 p-4 bg-background rounded-lg border hover:border-gray-400 transition-colors">
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <h3 className="font-medium">{order.vendor}</h3>
        <p className="text-sm text-muted-foreground">Order #{order.orderId}</p>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
        <span className={`text-sm ${getStatusColor(order.latestStatus)}`}>
          {formatStatusText(order.latestStatus)}
        </span>
      </div>
    </div>
    
    <div className="text-sm space-y-1">
      <p>Ordered: {formatDate(order.orderDate)}</p>
      {order.trackingUrl && (
        <p>
          <a 
            href={order.trackingUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:underline"
          >
            Track Order
          </a>
        </p>
      )}
      {order.return && (
        <div className="mt-2 p-2 bg-red-50 rounded">
          <p className="text-red-600">Return {order.return.status}</p>
          {order.return.trackingUrl && (
            <a 
              href={order.return.trackingUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-red-600 hover:underline text-sm"
            >
              Track Return
            </a>
          )}
        </div>
      )}
    </div>
  </div>
);

export default function FetchOrders() {
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [message, setMessage] = useState<string>("Checking for new orders...");
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/orders', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.statusText}`);
      }

      const data: OrdersResponse = await response.json();
      
      if (data.success) {
        if (data.needsSync === false) {
          setMessage(data.message);
        } else if (data.data?.orderDetails) {
          setOrders(data.data.orderDetails);
          setLastSync(data.data.relevantEmails[0]?.messageTimestamp);
          setMessage(`Last synced: ${formatDate(new Date())}`);
        }
      } else {
        throw new Error(data.message || 'Failed to process orders');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch orders';
      setError(errorMessage);
      setMessage('Failed to fetch orders. Please try again.');
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const containerClasses = "min-h-[400px] border rounded-lg p-4 bg-muted/50";

  if (isLoading) {
    return (
      <div className={containerClasses}>
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => {
              setRetryCount(prev => prev + 1);
              fetchOrders();
            }}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={containerClasses}>
        <div className="flex flex-col items-center justify-center h-full space-y-2">
          <p className="text-sm text-muted-foreground">No orders found.</p>
          {lastSync && (
            <p className="text-xs text-muted-foreground">{message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{message}</p>
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">Found: {orders.length}</p>
            <button
              onClick={fetchOrders}
              className="p-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
              title="Refresh orders"
            >
              ↻
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {orders.map((order) => (
            <OrderCard key={order.orderId} order={order} />
          ))}
        </div>
      </div>
    </div>
  );
}

