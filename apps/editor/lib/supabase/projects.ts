import type { Scene } from "@shadercanvas/scene-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectRow, ProjectSummary } from "@/lib/supabase/database.types";

const TABLE = "projects";

export async function listProjects(
  supabase: SupabaseClient,
): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, updated_at, published_at")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ProjectSummary[];
}

export async function getProject(
  supabase: SupabaseClient,
  id: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from(TABLE).select("*").eq("id", id).maybeSingle();

  if (error) throw error;
  return data as ProjectRow | null;
}

/** Load a published project without auth (public view / embed API). */
export async function getPublishedProject(
  supabase: SupabaseClient,
  id: string,
): Promise<ProjectRow | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) throw error;
  return data as ProjectRow | null;
}

export async function createProject(
  supabase: SupabaseClient,
  userId: string,
  scene: Scene,
  name = "Untitled project",
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, name, scene_json: scene })
    .select("*")
    .single();

  if (error) throw error;
  return data as ProjectRow;
}

export async function saveProject(
  supabase: SupabaseClient,
  id: string,
  scene: Scene,
  name?: string,
): Promise<ProjectRow> {
  const payload: { scene_json: Scene; name?: string } = { scene_json: scene };
  if (name !== undefined) payload.name = name;

  const { data, error } = await supabase
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ProjectRow;
}

export async function renameProject(
  supabase: SupabaseClient,
  id: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ name }).eq("id", id);
  if (error) throw error;
}

export async function deleteProject(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function publishProject(
  supabase: SupabaseClient,
  id: string,
  publish: boolean,
): Promise<ProjectRow> {
  const { data, error } = await supabase
    .from(TABLE)
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return data as ProjectRow;
}
