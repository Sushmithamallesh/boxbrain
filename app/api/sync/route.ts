import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info('Sync endpoint called');
    
    return NextResponse.json({
      success: true,
      message: "Sync endpoint reached"
    });

  } catch (error) {
    logger.error('Sync failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      message: "Sync failed"
    }, { status: 500 });
  }
}
