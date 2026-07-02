# ShaderCanvas Studio — Editor

Next.js editor for layered WebGL shader scenes. Phase 2 adds Supabase auth, cloud projects, asset upload, and publish/embed.

## Quick start (local mode, no Supabase)

```bash
# From repo root
npm install
npm run dev:editor
```

Open [http://localhost:3001/editor](http://localhost:3001/editor). Save/load JSON and export PNG work without any backend.

## Supabase setup (cloud features)

Cloud save, dashboard, asset upload, and publish require a [Supabase](https://supabase.com) project.

### 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Wait for the database to provision

### 2. Run the database migration

1. In Supabase: **SQL Editor** → **New query**
2. Paste the contents of `supabase/migrations/001_projects_and_assets.sql`
3. Click **Run**

This creates:

- `projects` table (scene JSON, publish flag)
- `assets` metadata table
- `scene-assets` storage bucket with RLS policies

### 3. Configure auth

In **Authentication → Providers → Email**:

- Enable **Email** provider
- For local dev, you can disable **Confirm email** so sign-up works instantly

### 4. Add environment variables

```bash
cp .env.local.example .env.local
```

Fill in from **Project Settings → API**:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |

Optional for production embed links:

```
NEXT_PUBLIC_APP_URL=https://your-deployed-domain.com
```

Restart the dev server after changing env vars.

## Routes

| Route | Description |
|-------|-------------|
| `/dashboard` | List/create/rename/delete cloud projects |
| `/editor` | Editor (local mode) |
| `/editor?project=<uuid>` | Editor with cloud project loaded |
| `/auth/sign-in` | Email + password sign in / sign up |
| `/view/<uuid>` | Public read-only viewer (published only) |
| `/api/scene/<uuid>` | Public Scene JSON (published only, for embeds) |

## Testing the Phase 2 flow

### Auth

1. Start editor with Supabase env vars set
2. Visit `/auth/sign-in` → create account or sign in
3. Header shows email + **Sign out**

### Dashboard

1. Go to `/dashboard`
2. Click **+ New project** → opens editor with default scene
3. **Rename** / **Delete** from the project list

### Cloud save

1. Open a project (or edit in `/editor` while signed in)
2. Click **Save to cloud** (or **Save new project** if no project ID yet)
3. URL updates to `/editor?project=<uuid>`
4. Auto-save runs ~30s after changes (when a project ID exists)

### Asset upload

1. Add an **Image** layer
2. Upload an image while signed in → stored in `scene-assets` bucket, URL saved in scene JSON
3. Signed out → falls back to data URL (same as Phase 1)

### Publish / embed

1. Save project to cloud first
2. Click **Publish** → **Publish now**
3. Copy share link (`/view/<uuid>`) or iframe embed code
4. **Unpublish** makes the view/API return 404

## Graceful degradation

If `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is missing:

- Editor works in local-only mode (Phase 1 behavior)
- Dashboard shows setup instructions
- Cloud buttons are hidden

## Scripts

```bash
npm run dev        # port 3001
npm run build
npm run typecheck
```

## Stubbed for later Phase 2 work

- Cloud effect presets (still localStorage only)
- Performance panel
- Templates / onboarding
- Runtime SDK CDN URL in script embed snippet (placeholder)
- Billing / monetization
