import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPublishedProject } from "@/lib/supabase/projects";

/** Public Scene JSON endpoint for script embeds (published projects only). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const project = await getPublishedProject(supabase, id);

    if (!project) {
      return NextResponse.json({ error: "Not found or not published" }, { status: 404 });
    }

    return NextResponse.json(project.scene_json, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
