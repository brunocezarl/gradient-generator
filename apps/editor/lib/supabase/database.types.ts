import type { Scene } from "@shadercanvas/scene-schema";

/** Database row shapes — keep in sync with supabase/migrations/*.sql */
export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  scene_json: Scene;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface AssetRow {
  id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
  published_at: string | null;
}
