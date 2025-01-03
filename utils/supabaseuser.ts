import { getSupabaseClient } from "./supabase/client-singleton";


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
    //to do remove this.
    await updateUserLastSynced('');
    return user?.user_metadata?.last_synced || '';
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
  
  