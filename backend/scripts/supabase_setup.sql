-- Supabase SQL setup script
-- Run this in the Supabase SQL editor to set up the database tables

-- Users table
create table public.users (
    id uuid not null primary key,
    email text not null unique,
    full_name text,
    is_active boolean default true,
    created_at timestamp with time zone default now()
);

-- User credentials table (separate for security)
create table public.user_credentials (
    user_id uuid not null references public.users(id) on delete cascade,
    password_hash text not null,
    primary key (user_id)
);

-- Browsing history table
create table public.browsing_history (
    id uuid not null primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    url text not null,
    title text,
    timestamp timestamp with time zone default now(),
    metadata jsonb default '{}'::jsonb
);

-- Query history table
create table public.query_history (
    id uuid not null primary key,
    user_id uuid not null references public.users(id) on delete cascade,
    query text not null,
    answer text not null,
    url text not null,
    timestamp timestamp with time zone default now()
);

-- Create indexes
create index idx_browsing_history_user_id on public.browsing_history(user_id);
create index idx_query_history_user_id on public.query_history(user_id);

-- Row level security policies
-- Only allow users to see their own data
alter table public.users enable row level security;
alter table public.user_credentials enable row level security;
alter table public.browsing_history enable row level security;
alter table public.query_history enable row level security;

-- User policies
create policy "Users can view their own data"
  on public.users
  for select
  using (auth.uid() = id);

-- Browsing history policies
create policy "Users can view their own browsing history"
  on public.browsing_history
  for select
  using (auth.uid() = user_id);

-- Query history policies
create policy "Users can view their own query history"
  on public.query_history
  for select
  using (auth.uid() = user_id);
