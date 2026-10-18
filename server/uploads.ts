import { randomUUID } from "node:crypto";
import { insertUpload } from "./db";
import { ENV } from "./_core/env";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf", "text/plain"]);
export async function preparePublicUpload(input: { formId: string; questionId: string; fileName: string; mimeType: string; size: number }) {
  if (!Number.isInteger(input.size) || input.size < 1 || input.size > MAX_UPLOAD_BYTES) throw new Error("File must be between 1 byte and 10 MB.");
  if (!ALLOWED_MIME.has(input.mimeType.toLowerCase())) throw new Error("This file type is not supported.");
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "upload";
  const key = `spaceform/forms/${input.formId}/questions/${input.questionId}/${randomUUID()}-${safeName}`;
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) throw new Error("File uploads are unavailable until storage is configured.");
  const endpoint = new URL("v1/storage/presign/put", ENV.forgeApiUrl.replace(/\/+$/, "") + "/");
  endpoint.searchParams.set("path", key);
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${ENV.forgeApiKey}` } });
  if (!response.ok) throw new Error(`Storage presign failed (${response.status}).`);
  const data = await response.json() as { url?: string; error?: string };
  if (!data.url) throw new Error(data.error || "Storage did not return an upload URL.");
  await insertUpload({ id: randomUUID(), formId: input.formId, key, url: `/manus-storage/${key}`, contentType: input.mimeType, byteSize: input.size });
  return { uploadUrl: data.url, assetPath: `/manus-storage/${key}` };
}
