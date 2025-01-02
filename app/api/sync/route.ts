import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    logger.info('Sync endpoint called');
    
    // Dummy sync endpoint - just return success
    return NextResponse.json({
      success: true,
      message: "Sync completed successfully"
    });

  } catch (error) {
    const err = error as Error;
    logger.error('Sync failed', {
      message: err.message,
      stack: err.stack
    });

    return NextResponse.json({
      success: false,
      message: "Sync failed"
    }, { status: 500 });
  }
}
