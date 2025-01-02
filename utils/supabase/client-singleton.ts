import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "../logger";

class SupabaseClient {
  private static instance: ReturnType<typeof createServerClient> | null = null;

  private constructor() {}

  public static async getInstance() {
    if (!SupabaseClient.instance) {
      const cookieStore = await cookies();

      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        const error = new Error('Supabase environment variables are not set');
        logger.error('Supabase client initialization failed:', { error });
        throw error;
      }

      SupabaseClient.instance = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              } catch (error) {
                // The `set` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      );

      logger.info('Supabase client initialized');
    }

    return SupabaseClient.instance;
  }
}

export const getSupabaseClient = SupabaseClient.getInstance; 