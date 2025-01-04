import { NextResponse } from "next/server";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be  GET / 200 in 25ms
{"timestamp":"2025-01-04T19:55:03.032Z","requestId":"mmec0n","level":"info","message":"Redirecting to OAuth provider","url":"https://sdyamnvfvvkpdrtekeqi.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Fcallback&code_challenge=qh85LltNfmV_O8Voj4ZCXqw5FHCtT2nyo9zRBxg0BsU&code_challenge_method=s256&access_type=offline&prompt=consent&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email+https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.profile+openid"}
 POST / 303 in 13ms
{"timestamp":"2025-01-04T19:55:07.547Z","requestId":"mmec0n","level":"error","message":"No code verifier provided"}
 GET /auth/callback?code=c078c471-36a3-4c94-9b7c-0d29a221a70b 307 in 21ms
 GET /?error=Authentication%20failed%3A%20Missing%20code%20verifier 200 in 13msd and added as a query parameter.
 * @param {string} origin - The origin URL (e.g., requestUrl.origin)
 * @returns {NextResponse} A NextResponse redirect with the encoded message.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
  origin: string
) {
  return NextResponse.redirect(
    new URL(`${path}?${type}=${encodeURIComponent(message)}`, origin)
  );
}