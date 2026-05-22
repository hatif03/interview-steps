# Supabase setup

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run [`migrations/001_initial_schema.sql`](migrations/001_initial_schema.sql).
3. Under **Authentication → Providers**, enable **Google** (optional) and set **URL Configuration**:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
4. Copy credentials from **Project Settings → API**:
   - **Backend** (`backend/.env`): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - **Frontend** (`frontend/.env`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
