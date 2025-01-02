import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logger } from '@/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' }, 
        { status: 401 }
      );
    }

    const metadata = user.user_metadata as { last_synced?: string };

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
      orders,
      message: metadata.last_synced 
        ? `Last synced: ${new Date(metadata.last_synced).toLocaleString()}`
        : 'Initial sync in progress...'
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