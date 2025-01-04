"use server";

import { createServerSupabaseClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

const baseUrl = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export async function signInWithGoogle() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
      queryParams: {
        access_type: "offline"
      }
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("No URL returned from OAuth provider");

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect('/');
}
