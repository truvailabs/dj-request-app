import { createClient } from "@supabase/supabase-js";
import { env } from "./env.js";

// Service role client: server-side only, bypasses RLS. Never expose this key to the client.
export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Anon-scoped client, used only to validate a DJ's Supabase Auth JWT via auth.getUser().
const supabaseAuthClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function getDjUserFromToken(token: string) {
  const { data, error } = await supabaseAuthClient.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}
