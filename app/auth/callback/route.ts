import { getSupabaseClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/utils/logger";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const error_description = requestUrl.searchParams.get("error_description");

  // Handle error response from OAuth provider
  if (error || error_description) {
    logger.error("OAuth error:", { error, error_description });
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error_description || "Unknown error")}`, requestUrl.origin)
    );
  }

  if (!code) {
    logger.error("No code provided in callback");
    return NextResponse.redirect(
      new URL("/?error=No+authorization+code+provided", requestUrl.origin)
    );
  }

  try {
    const supabase = await getSupabaseClient();
    
    // Exchange the code for a session
    const { data, error: signInError } = await supabase.auth.exchangeCodeForSession(code);

    if (signInError || !data?.session) {
      logger.error("Sign in error:", { error: signInError?.message, hasSession: !!data?.session });
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(signInError?.message || "Failed to create session")}`, requestUrl.origin)
      );
    }

    logger.info("Successfully authenticated user", { 
      userId: data.session.user.id,
      email: data.session.user.email 
    });

    // Create response with redirect and allow Supabase client to set cookies
    const response = NextResponse.redirect(new URL("/boxes/home", requestUrl.origin));

    return response;
  } catch (error) {
    logger.error("Unexpected error in auth callback:", { 
      error: error instanceof Error ? error.message : "Unknown error" 
    });
    return NextResponse.redirect(
      new URL("/?error=Unexpected+error+during+authentication", requestUrl.origin)
    );
  }
} 