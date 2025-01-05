import { getSupabaseClient } from "./client-singleton";


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

  export async function getUserLastSynced() {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    console.log("User metadata in getUserLastSynced:", user?.user_metadata);
    const lastSynced = user?.user_metadata?.last_synced || '';
    console.log("Last synced value:", lastSynced);
    return { last_synced: lastSynced };
  } 
  
  export async function updateUserLastSynced(last_synced: string) {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return {};
  
    console.log("Updating last_synced to:", last_synced);
    const { data, error } = await supabase.auth.updateUser({
      data: { 
        ...user.user_metadata,  // Preserve existing metadata
        last_synced 
      }
    });
  
    if (error) {
      console.error('Failed to update last_synced:', error);
      return user.user_metadata || {};
    }
  
    console.log("Updated user metadata:", data.user.user_metadata);
    return data.user.user_metadata || {};
  }
  
  