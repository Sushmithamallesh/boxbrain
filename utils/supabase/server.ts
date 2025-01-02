import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

class SupabaseManager {
  private static instance: ReturnType<typeof createServerClient> | null = null;

  static async getClient() {
    if (!SupabaseManager.instance) {
      const cookieStore = await cookies();
      SupabaseManager.instance = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
        },
      );
    }
    return SupabaseManager.instance;
  }
}

export const getSupabaseClient = SupabaseManager.getClient;
