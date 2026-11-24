import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Business, Professional, Service } from "./types.ts";

let client: SupabaseClient | null = null;
export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente.");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export async function getBusiness(slug: string): Promise<Business | null> {
  const { data, error } = await db().from("businesses").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data as Business | null;
}
export async function getCatalog(businessId: string) {
  const [s, p] = await Promise.all([
    db().from("services").select("*").eq("business_id", businessId).eq("active", true).order("sort"),
    db().from("professionals").select("id,name,info").eq("business_id", businessId).eq("active", true).order("sort"),
  ]);
  if (s.error) throw s.error;
  if (p.error) throw p.error;
  return { services: (s.data || []) as Service[], professionals: (p.data || []) as Professional[] };
}
export async function getBusy(businessId: string, from: Date, to: Date) {
  const { data, error } = await db().from("bookings").select("starts_at,ends_at,professional_id")
    .eq("business_id", businessId).neq("status", "cancelado")
    .lt("starts_at", to.toISOString()).gt("ends_at", from.toISOString());
  if (error) throw error;
  return (data || []).map(b => ({ start: new Date(b.starts_at), end: new Date(b.ends_at), professional_id: b.professional_id as string | null }));
}
