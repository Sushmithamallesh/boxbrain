import { getSupabaseClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await getSupabaseClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // After successful auth, redirect to protected dashboard
  return NextResponse.redirect(new URL("/boxes/home", requestUrl.origin));
} 