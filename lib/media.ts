// Fotos e vídeos que o dono envia pelo painel. Ficam no Supabase Storage (plano grátis: 1 GB),
// numa pasta pública "midia", separados por negócio: midia/<link>/<arquivo>.
import { randomBytes } from "node:crypto";
import { db } from "./db.ts";

export const BUCKET = "midia";
export const MAX_FOTO = 10 * 1024 * 1024;   // 10 MB (o navegador já reduz a foto antes de enviar)
export const MAX_VIDEO = 50 * 1024 * 1024;  // 50 MB (limite do plano grátis do Supabase)
const TIPOS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov",
};

let pronto = false;
async function garantirPasta() {
  if (pronto) return;
  const { data } = await db().storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await db().storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_VIDEO, allowedMimeTypes: Object.keys(TIPOS) });
    if (error && !/already exists/i.test(error.message)) throw error;
  }
  pronto = true;
}

/** Cria um endereço de envio direto do navegador para o Storage (evita o limite de 4,5 MB da Vercel). */
export async function linkDeEnvio(slug: string, tipo: string, tamanho: number) {
  const ext = TIPOS[tipo];
  if (!ext) return { erro: "Formato não aceito. Use foto JPG, PNG ou WEBP, ou vídeo MP4." };
  const max = tipo.startsWith("video/") ? MAX_VIDEO : MAX_FOTO;
  if (!(tamanho > 0) || tamanho > max) return { erro: `Arquivo grande demais (máximo ${max / 1024 / 1024} MB).` };
  await garantirPasta();
  const path = `${slug}/${Date.now().toString(36)}-${randomBytes(6).toString("hex")}.${ext}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw error || new Error("sem link de envio");
  return { path, signedUrl: data.signedUrl };
}

/** Confere que o arquivo é deste negócio e devolve o endereço público. */
export function enderecoPublico(slug: string, path: string): string | null {
  if (!new RegExp(`^${slug}/[a-z0-9]+-[0-9a-f]{12}\\.(jpg|png|webp|mp4|webm|mov)$`).test(path)) return null;
  return db().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Apaga do Storage um arquivo enviado pelo painel (os de exemplo em /media ficam). */
export async function apagarArquivo(slug: string, url: string | null | undefined) {
  if (!url) return;
  const m = url.match(new RegExp(`/storage/v1/object/public/${BUCKET}/(${slug}/[^?#]+)$`));
  if (m) await db().storage.from(BUCKET).remove([m[1]]).catch(() => {});
}
