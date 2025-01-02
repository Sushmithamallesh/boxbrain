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
  const [message, setMessage] = useState<string>("This should only take a short time...");

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
          setMessage("Looks like it's your first time here. Fetching all data from the past month...");
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
        setMessage('Failed to fetch orders. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className="border rounded-lg p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">No orders found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div key={order.id} className="border rounded-lg p-4 bg-muted/50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Order #{order.orderNumber}</h3>
            <span className="text-sm text-muted-foreground">{order.status}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            <p>Carrier: {order.carrier}</p>
            <p>Tracking: {order.trackingNumber}</p>
            <p>Estimated Delivery: {order.estimatedDelivery}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

