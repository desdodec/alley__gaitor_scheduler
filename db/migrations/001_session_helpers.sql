-- Alley Gaitor Scheduler — session helper access
-- Run this once in the Supabase SQL Editor.

create table if not exists session_helpers (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  access_code_hash text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists session_helpers_active_idx
  on session_helpers (is_active);

alter table session_helpers enable row level security;

-- No browser-facing RLS policies are created. Session helper authentication
-- is handled by Netlify Functions using the server-side PostgreSQL connection.
