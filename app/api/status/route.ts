import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Diagnóstico do deploy: diz o que falta, sem mostrar nenhum valor secreto.
export async function GET() {
  const env = {
    SUPABASE_URL: !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY),
    WHATSAPP_TOKEN: !!process.env.WHATSAPP_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    PAINEL_SENHA: (process.env.PAINEL_SENHA || "").length >= 8,
    WHATSAPP_APP_SECRET: !!process.env.WHATSAPP_APP_SECRET,
    AVISO_EMAIL: !!process.env.AVISO_EMAIL,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
  };
  let banco = "não testado";
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { data, error } = await db().from("businesses").select("slug");
      banco = error ? `erro: ${error.message}` : `ok (${(data || []).length} negócios cadastrados)`;
    } catch (e) { banco = `erro: ${(e as Error).message}`; }
  }
  return NextResponse.json({ env, banco });
}
