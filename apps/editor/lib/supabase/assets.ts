import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "scene-assets";

/** Upload an image to Supabase Storage; returns a public URL. */
export async function uploadSceneAsset(
  supabase: SupabaseClient,
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/png",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  // Optional metadata row — failures here shouldn't block the upload URL.
  await supabase.from("assets").insert({
    user_id: userId,
    storage_path: path,
    public_url: publicUrl,
    mime_type: file.type || null,
    size_bytes: file.size,
  });

  return publicUrl;
}
