import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "documents";

let _client: SupabaseClient | null = null;

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

function getClient(): SupabaseClient {
  if (!_client) {
    const rawUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!rawUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment secrets.");
    }

    const supabaseUrl = normalizeUrl(rawUrl);
    console.log(`[supabase] connecting to: ${supabaseUrl.slice(0, 30)}...`);

    _client = createClient(supabaseUrl, supabaseKey.trim());
  }
  return _client;
}

export async function uploadFileToSupabase(
  buffer: Buffer,
  path: string,
  mimeType: string
): Promise<string> {
  const client = getClient();

  const { error } = await client.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
