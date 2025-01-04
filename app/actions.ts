"use server";

import { getSupabaseClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { logger } from "@/utils/logger";

export async function signInWithGoogle() {
  try {
    const supabase = await getSupabaseClient();
    const origin = (await headers()).get("origin");

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          scope: [
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid"
          ].join(" ")
        },
      },
    });

    if (error) {
      logger.error("Auth Error:", { message: error.message });
      if (error.message.includes("provider is not enabled")) {
        throw new Error("Google authentication is not configured. Please contact support.");
      }
      throw error;
    }

    if (!data?.url) {
      throw new Error("No URL returned from sign in attempt");
    }

    logger.info("Redirecting to OAuth provider", { url: data.url });
    return redirect(data.url);
  } catch (error) {
    if (error instanceof Error && error.message === 'NEXT_REDIRECT') {
      // This is expected, let Next.js handle the redirect
      throw error;
    }
    logger.error("Unexpected error in signInWithGoogle:", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    throw error;
  }
}

export const signOutAction = async () => {
  const supabase = await getSupabaseClient();
  await supabase.auth.signOut();
  return redirect("/");
};
