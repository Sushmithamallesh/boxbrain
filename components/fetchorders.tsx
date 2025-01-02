'use client';

import { useEffect, useState } from 'react';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  carrier: string;
  trackingNumber: string;
  estimatedDelivery: string;
}

export default function FetchOrders() {
  const [isLoading, setIsLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState<string>("this should only take a short time...");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First check user metadata for last sync
        const metadataResponse = await fetch('/api/user/metadata', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!metadataResponse.ok) {
          throw new Error('Failed to fetch user metadata');
        }

        const { last_synced } = await metadataResponse.json();
        const isFirstTime = !last_synced;
        
        // Update message if it's first time
        if (isFirstTime) {
          setMessage("looks like it's your first time here. fetching all data from the past month...");
        }

        // Then sync orders
        const syncResponse = await fetch('/api/sync', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!syncResponse.ok) {
          throw new Error('Failed to sync orders');
        }

        // Finally fetch the orders
        const response = await fetch('/api/orders', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch orders');
        }

        const data = await response.json();
        setOrders(data.orders || []);
        setMessage(data.message || '');
      } catch (error) {
        console.error('Error fetching orders:', error);
        setMessage('failed to fetch orders. please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const containerClasses = "min-h-[400px] border rounded-lg p-4 bg-muted/50";

  if (isLoading) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className={containerClasses}>
        <p className="text-sm text-muted-foreground">no orders found.</p>
      </div>
    );
  }

  return (
    <div className={containerClasses}>
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="border rounded-lg p-4 bg-muted/50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">order #{order.orderNumber}</h3>
              <span className="text-sm text-muted-foreground">{order.status}</span>
            </div>
            <div className="text-sm text-muted-foreground">
              <p>carrier: {order.carrier}</p>
              <p>tracking: {order.trackingNumber}</p>
              <p>estimated delivery: {order.estimatedDelivery}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
