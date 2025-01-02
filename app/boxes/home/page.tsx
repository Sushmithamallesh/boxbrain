import { createClient } from "@/utils/supabase/server";
import { ArrowRight } from "lucide-react";
import { logger } from '@/utils/logger';
import FetchOrders from "@/components/fetchorders";
import { getEntityIdFromEmail } from "@/utils/composio";

export default async function HomePage() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      logger.warn('No user email found');
      return (
        <div className="flex-1 w-full flex flex-col gap-8 max-w-4xl mx-auto">
          <div className="min-h-[400px] border border-red-200 rounded-lg p-6 bg-red-50/50 dark:bg-red-950/50">
            <p className="text-[hsl(var(--blood-red))]">unable to get user email. please try logging in again.</p>
          </div>
        </div>
      );
    }

    logger.info('User authenticated', { 
      email: user.email 
    });

    const entityId = getEntityIdFromEmail(user.email);

    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
      
    logger.debug('Using base URL for API requests', { baseUrl });

    // Get the current session for auth
    const { data: { session } } = await supabase.auth.getSession();
    logger.debug('Session retrieved', { 
      hasSession: !!session,
      userId: session?.user?.id
    });

    const response = await fetch(`${baseUrl}/api/connect/${encodeURIComponent(entityId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Metadata': JSON.stringify(user.user_metadata)
      },
      cache: 'no-store'
    });

    logger.info('Making API request to connect endpoint', {
      url: `${baseUrl}/api/connect/${encodeURIComponent(entityId)}`,
      entityId
    });

    if (!response.ok) {
      logger.error('Connection request failed', {
        status: response.status,
        statusText: response.statusText
      });
      throw new Error(`Failed to fetch connection status: ${response.statusText}`);
    }

    const connectionStatus = await response.json();
    logger.info('Connection status received', {
      isExistingAccount: connectionStatus.isExistingAccount,
      success: connectionStatus.success
    });

    logger.debug('Raw response received', {
      status: response.status,
      ok: response.ok,
      statusText: response.statusText
    });

    const containerClasses = "min-h-[400px] border rounded-lg p-6 bg-muted/50";

    return (
      <div className="flex-1 w-full flex flex-col gap-8 max-w-4xl mx-auto">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[hsl(var(--blood-red))]">your boxes</h1>
        </div>

        {connectionStatus.isExistingAccount ? (
          <div className={containerClasses}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <p className="font-medium">gmail connected</p>
            </div>
            <FetchOrders />
          </div>
        ) : connectionStatus.success ? (
          <div className={containerClasses}>
            <h2 className="font-medium mb-3">connect your gmail 📬</h2>
            <p className="text-sm text-muted-foreground mb-6">
              let's get started by connecting your gmail account to track your packages automatically.
            </p>
            <a 
              href={connectionStatus.data}
              className="group inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-md border hover:border-[hsl(var(--blood-red))] hover:text-[hsl(var(--blood-red))]"
            >
              connect gmail
              <ArrowRight size={16} className="text-muted-foreground group-hover:text-[hsl(var(--blood-red))] transition-colors" />
            </a>
          </div>
        ) : (
          <div className="min-h-[400px] border border-red-200 rounded-lg p-6 bg-red-50/50 dark:bg-red-950/50">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-[hsl(var(--blood-red))]"></div>
              <p className="text-[hsl(var(--blood-red))]">connection failed. please refresh the page.</p>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    logger.error('Page error', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  }
} 