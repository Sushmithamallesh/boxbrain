'use client';

import { useEffect, useState } from 'react';
import { OrderDetails, OrderStatus, OrdersResponse } from '@/types/orders';

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
    case 'delivered':
      return 'text-green-600';
    case 'shipped':
      return 'text-blue-600';
    case 'processing':
    case 'ordered':
      return 'text-yellow-600';
    case 'cancelled':
    case 'returned':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
};

const isActiveOrder = (status: OrderStatus): boolean => {
  return status !== 'cancelled' && status !== 'returned';
};

const OrderCard = ({ order }: { order: OrderDetails }) => {
  const hasReturn = order.return && order.return.status;
  
  return (
    <div className={`flex flex-col gap-2 p-4 bg-background rounded-lg border hover:border-gray-400 transition-colors ${
      !isActiveOrder(order.latestStatus) ? 'opacity-75' : ''
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="font-medium">{order.vendor}</h3>
          <p className="text-sm text-muted-foreground">Order #{order.orderId}</p>
        </div>
        <div className="flex flex-col items-end">
          <span className="font-medium">{formatCurrency(order.totalAmount, order.currency)}</span>
          <span className={`text-sm ${getStatusColor(order.latestStatus)} ${
            order.latestStatus === 'cancelled' ? 'font-medium' : ''
          }`}>
            {order.latestStatus.toLowerCase().replace(/_/g, ' ')}
            {order.latestStatus === 'cancelled' && ' ⚠️'}
          </span>
        </div>
      </div>
      
      <div className="text-sm space-y-1">
        <p>Ordered: {formatDate(order.orderDate)}</p>
        {order.metadata && (
          <div key="metadata" className="text-xs text-muted-foreground">
            {order.metadata.itemCount && <p key="itemCount">Items: {order.metadata.itemCount}</p>}
            {order.metadata.estimatedDelivery && (
              <p key="estimatedDelivery">Estimated delivery: {formatDate(order.metadata.estimatedDelivery)}</p>
            )}
          </div>
        )}
        {order.trackingUrl && order.latestStatus !== 'cancelled' && (
          <p key="tracking">
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
        {hasReturn && (
          <div key="return" className="mt-2 p-2 bg-red-50 rounded">
            <p className="text-red-600">Return {order.return?.status.replace(/_/g, ' ')}</p>
            {order.return?.trackingUrl && (
              <a 
                key="returnTracking"
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
};

export default function FetchOrders() {
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<OrderDetails[]>([]);
  const [message, setMessage] = useState<string>("Checking for new orders...");
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error(`Failed to fetch orders: ${response.statusText}`);

      const data: OrdersResponse = await response.json();
      
      if (data.success) {
        if (data.data?.orderDetails) {
          setOrders(data.data.orderDetails);
        }
        setMessage(data.message);
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

  const Container = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-[400px] border rounded-lg p-4 bg-muted/50">
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center h-full">
          <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchOrders}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </Container>
    );
  }

  if (orders.length === 0) {
    return (
      <Container>
        <div className="flex flex-col items-center justify-center h-full space-y-2">
          <p className="text-sm text-muted-foreground">No orders found.</p>
          <p className="text-xs text-muted-foreground">{message}</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex flex-col space-y-4">
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
        {orders.map((order) => (
          <OrderCard key={order.orderId} order={order} />
        ))}
      </div>
    </Container>
  );
}

