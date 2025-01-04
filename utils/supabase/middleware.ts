import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export const updateSession = async (request: NextRequest) => {
  try {
    // Skip middleware for auth callback route
    if (request.nextUrl.pathname === '/auth/callback') {
      return NextResponse.next();
    }

    // Create a response early to modify cookies
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            request.cookies.delete(name);
            response.cookies.delete(name);
          },
        },
      }
    );

    const { data: { session }, error } = await supabase.auth.getSession();

    // Protect all routes under /boxes
    if (request.nextUrl.pathname.startsWith("/boxes")) {
      if (!session) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }

    return response;
  } catch (e) {
    // On error in protected routes, redirect to home
    if (request.nextUrl.pathname.startsWith("/boxes")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
