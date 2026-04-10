import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "documents";

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.SUPABASE_URL?.trim();
    const supabaseKey = process.env.SUPABASE_ANON_KEY?.trim();

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment secrets.");
    }

    _client = createClient(supabaseUrl, supabaseKey);
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
