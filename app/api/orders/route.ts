import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';
import { getUserMetadata } from '@/utils/utils';

export async function GET(req: NextRequest) {
  try {
    const { last_synced } = await getUserMetadata();
    if (!last_synced) {
        // fetch all data from the past month
    } else {
        // fetch data from last synced time
        // if last synced time is more than 5 minutes ago, sync again
    }

    // fetch data from orders table and return it

    // update last synced time in user metadata
    

    // For now, return dummy data
    // TODO: Implement actual order fetching from database
    const orders = [
      {
        id: '1',
        orderNumber: 'ORD-001',
        status: 'In Transit',
        carrier: 'UPS',
        trackingNumber: '1Z999AA1234567890',
        estimatedDelivery: '2024-02-20'
      },
      {
        id: '2',
        orderNumber: 'ORD-002',
        status: 'Delivered',
        carrier: 'FedEx',
        trackingNumber: '794583957364',
        estimatedDelivery: '2024-02-18'
      }
    ];

    return NextResponse.json({
      success: true,
      orders
    });

  } catch (error) {
    const err = error as Error;
    logger.error('Failed to fetch orders:', { 
      message: err.message,
      stack: err.stack 
    });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 