import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { logger } from '@/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not authenticated' }, 
        { status: 401 }
      );
    }

    const metadata = user.user_metadata as { last_synced?: string };

    return NextResponse.json({
      success: true,
      last_synced: metadata.last_synced
    });

  } catch (error) {
    const err = error as Error;
    logger.error('Failed to fetch user metadata:', { 
      message: err.message,
      stack: err.stack 
    });
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 