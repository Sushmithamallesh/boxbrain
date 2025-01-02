import { redirect } from "next/navigation";
import {  getSupabaseClient } from "./supabase/server";

/**
 * Redirects to a specified path with an encoded message as a query parameter.
 * @param {('error' | 'success')} type - The type of message, either 'error' or 'success'.
 * @param {string} path - The path to redirect to.
 * @param {string} message - The message to be encoded and added as a query parameter.
 * @returns {never} This function doesn't return as it triggers a redirect.
 */
export function encodedRedirect(
  type: "error" | "success",
  path: string,
  message: string,
) {
  return redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

export async function getUserMetadata() {
  const supabase = await getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.user_metadata || {};
}

export async function getUserMail() {
  const supabase = await getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email || '';  
}

export async function updateUserLastSynced(last_synced: string) {
  const supabase = await getSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return {};

  const { data, error } = await supabase.auth.updateUser({
    data: { last_synced }
  });

  if (error) {
    console.error('Failed to update last_synced:', error);
    return user.user_metadata || {};
  }

  return data.user.user_metadata || {};
}

