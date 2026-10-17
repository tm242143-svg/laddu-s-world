-- Laddu's World: run this whole file in Supabase SQL Editor.
-- All user foreign keys use auth.users(id) UUIDs.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Viewer' check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  code text not null unique check (char_length(code) between 6 and 12),
  visibility text not null default 'private' check (visibility in ('private','public')),
  host_id uuid not null references auth.users(id) on delete cascade,
  current_media_id uuid,
  playback_state jsonb not null default '{"playing":false,"position":0,"updated_at":0}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.room_members (
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.media_library (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 150),
  kind text not null check (kind in ('movie','song')),
  category text not null default 'General',
  duration text,
  description text,
  storage_path text,
  public_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  constraint media_has_source check (storage_path is not null or public_url is not null or is_published = false)
);

alter table public.rooms drop constraint if exists rooms_current_media_id_fkey;
alter table public.rooms add constraint rooms_current_media_id_fkey foreign key (current_media_id) references public.media_library(id) on delete set null;

create table if not exists public.friendships (
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index if not exists rooms_created_at_idx on public.rooms(created_at desc);
create index if not exists rooms_host_id_idx on public.rooms(host_id);
create index if not exists media_library_published_idx on public.media_library(is_published, kind);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.media_library enable row level security;
alter table public.friendships enable row level security;

-- Profiles are visible to signed-in users; each user can edit only their own.
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
drop policy if exists "profile owner inserts" on public.profiles;
create policy "profile owner inserts" on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists "profile owner updates" on public.profiles;
create policy "profile owner updates" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Public rooms are discoverable. Private rooms can be read by their host or members.
drop policy if exists "read public rooms or own rooms" on public.rooms;
create policy "read public rooms or own rooms" on public.rooms for select to authenticated using (visibility = 'public' or host_id = auth.uid() or exists (select 1 from public.room_members rm where rm.room_id = rooms.id and rm.user_id = auth.uid()));
drop policy if exists "authenticated create own rooms" on public.rooms;
create policy "authenticated create own rooms" on public.rooms for insert to authenticated with check (host_id = auth.uid());
drop policy if exists "host updates rooms" on public.rooms;
create policy "host updates rooms" on public.rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
drop policy if exists "host deletes rooms" on public.rooms;
create policy "host deletes rooms" on public.rooms for delete to authenticated using (host_id = auth.uid());

-- Users can view room membership when they are members or the room host.
drop policy if exists "room membership visible to room participants" on public.room_members;
create policy "room membership visible to room participants" on public.room_members for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.rooms r where r.id = room_id and (r.host_id = auth.uid() or r.visibility = 'public')));
drop policy if exists "users join themselves" on public.room_members;
create policy "users join themselves" on public.room_members for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.rooms r where r.id = room_id and (r.visibility = 'public' or r.host_id = auth.uid())));
drop policy if exists "users leave or host removes members" on public.room_members;
create policy "users leave or host removes members" on public.room_members for delete to authenticated using (user_id = auth.uid() or exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));

-- Published library items are readable by authenticated users. Only service-role/admin actions should publish media.
drop policy if exists "read published media" on public.media_library;
create policy "read published media" on public.media_library for select to authenticated using (is_published = true);

-- Friendships are visible to either party; only requester can create a request.
drop policy if exists "friendship parties can read" on public.friendships;
create policy "friendship parties can read" on public.friendships for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "requester creates friendship" on public.friendships;
create policy "requester creates friendship" on public.friendships for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "friendship parties update" on public.friendships;
create policy "friendship parties update" on public.friendships for update to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid()) with check (requester_id = auth.uid() or addressee_id = auth.uid());
drop policy if exists "friendship parties delete" on public.friendships;
create policy "friendship parties delete" on public.friendships for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Create a profile automatically at sign-up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Viewer'))
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Join by invite code without exposing private-room rows to the whole authenticated user base.
-- This function checks the exact code and creates the caller's membership atomically.
create or replace function public.join_room_by_code(p_code text)
returns setof public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_room public.rooms;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  select * into selected_room
  from public.rooms r
  where upper(r.code) = upper(trim(p_code))
    and (r.visibility = 'public' or r.code = upper(trim(p_code)))
  limit 1;
  if selected_room.id is null then
    return;
  end if;
  insert into public.room_members (room_id, user_id)
  values (selected_room.id, auth.uid())
  on conflict (room_id, user_id) do nothing;
  return next selected_room;
end;
$$;
revoke all on function public.join_room_by_code(text) from public;
grant execute on function public.join_room_by_code(text) to authenticated;

-- Realtime broadcasts require no chat table for the starter. Supabase Realtime channels are used for chat/presence.
-- Do not expose the Supabase service_role key in the browser.

-- Private device video uploads: uploader + authorized room members only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('room-videos', 'room-videos', false, 1073741824, array['video/mp4','video/webm','video/quicktime','video/x-matroska','video/ogg'])
on conflict (id) do update set public = false, file_size_limit = 1073741824;

drop policy if exists "room video owner uploads" on storage.objects;
create policy "room video owner uploads" on storage.objects for insert to authenticated
with check (
  bucket_id = 'room-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1 from public.room_members rm
    where rm.room_id::text = (storage.foldername(name))[2] and rm.user_id = auth.uid()
  )
);
drop policy if exists "room video authorized members read" on storage.objects;
create policy "room video authorized members read" on storage.objects for select to authenticated
using (
  bucket_id = 'room-videos'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (
      select 1 from public.room_members rm
      where rm.room_id::text = (storage.foldername(name))[2] and rm.user_id = auth.uid()
    )
  )
);
drop policy if exists "room video uploader deletes own" on storage.objects;
create policy "room video uploader deletes own" on storage.objects for delete to authenticated
using (bucket_id = 'room-videos' and (storage.foldername(name))[1] = auth.uid()::text);
-- Laddu's World: secure room creation RPC.
-- Run this in Supabase Dashboard > SQL Editor.
-- It derives host_id from the authenticated JWT, instead of trusting the browser.

CREATE OR REPLACE FUNCTION public.create_room(
  p_name text,
  p_code text,
  p_visibility text DEFAULT 'private'
)
RETURNS SETOF public.rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user_id uuid;
  v_room public.rooms;
  v_name text;
  v_visibility text;
  v_code text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to create a room'
      USING ERRCODE = '28000';
  END IF;

  v_name := pg_catalog.btrim(COALESCE(p_name, ''));
  v_code := pg_catalog.upper(pg_catalog.btrim(COALESCE(p_code, '')));
  v_visibility := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_visibility, 'private')));

  IF v_name = '' OR pg_catalog.length(v_name) > 60 THEN
    RAISE EXCEPTION 'Room name must be between 1 and 60 characters'
      USING ERRCODE = '22023';
  END IF;

  IF v_code !~ '^[A-Z0-9]{6,12}$' THEN
    RAISE EXCEPTION 'Room code must be 6 to 12 letters or numbers'
      USING ERRCODE = '22023';
  END IF;

  IF v_visibility NOT IN ('private', 'public') THEN
    RAISE EXCEPTION 'Visibility must be private or public'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rooms (name, code, visibility, host_id)
  VALUES (v_name, v_code, v_visibility, v_user_id)
  RETURNING * INTO v_room;

  RETURN NEXT v_room;
  RETURN;
END;
$function$;

-- Only logged-in users may call this function.
REVOKE ALL ON FUNCTION public.create_room(text, text, text)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_room(text, text, text)
TO authenticated;

-- Avoid recursive RLS evaluation between rooms and room_members.
create or replace function public.can_access_room(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (r.visibility = 'public' or r.host_id = p_user_id
        or exists (select 1 from public.room_members rm where rm.room_id = r.id and rm.user_id = p_user_id))
  );
$$;
revoke all on function public.can_access_room(uuid, uuid) from public;
grant execute on function public.can_access_room(uuid, uuid) to authenticated;

drop policy if exists "read public rooms or own rooms" on public.rooms;
create policy "read public rooms or own rooms" on public.rooms for select to authenticated
using (public.can_access_room(id, auth.uid()));
drop policy if exists "room membership visible to room participants" on public.room_members;
create policy "room membership visible to room participants" on public.room_members for select to authenticated
using (user_id = auth.uid() or public.can_access_room(room_id, auth.uid()));
