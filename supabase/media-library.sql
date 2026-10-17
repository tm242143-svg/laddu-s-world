-- Laddu's World private media library migration.
-- Run after supabase/schema.sql in Supabase SQL Editor.
-- Existing room and room_members policies are not replaced by this migration.

create extension if not exists pgcrypto;

alter table public.media_library
  add column if not exists owner_id uuid references auth.users(id) on delete cascade,
  add column if not exists source_type text not null default 'upload',
  add column if not exists online_url text,
  add column if not exists shared_room_id uuid references public.rooms(id) on delete set null;

-- Keep legacy public/admin entries working while identifying online links.
update public.media_library
set source_type = case when storage_path is null and coalesce(online_url, public_url) is not null then 'link' else 'upload' end
where source_type is null or source_type = 'upload';

alter table public.media_library drop constraint if exists media_library_source_type_check;
alter table public.media_library add constraint media_library_source_type_check
  check (source_type in ('upload', 'link'));

create index if not exists media_library_owner_idx on public.media_library(owner_id, created_at desc);
create index if not exists media_library_shared_room_idx on public.media_library(shared_room_id, created_at desc);

-- Helper avoids room/room_members policy recursion. It returns only membership status.
create or replace function public.is_media_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_user_id is not null and exists (
    select 1 from public.rooms r
    where r.id = p_room_id
      and (r.host_id = p_user_id or exists (
        select 1 from public.room_members rm
        where rm.room_id = r.id and rm.user_id = p_user_id
      ))
  ), false);
$$;
revoke all on function public.is_media_room_member(uuid, uuid) from public;
grant execute on function public.is_media_room_member(uuid, uuid) to authenticated;

alter table public.media_library enable row level security;

drop policy if exists "read published media" on public.media_library;
drop policy if exists "media library select owner published or shared" on public.media_library;
create policy "media library select owner published or shared"
on public.media_library for select to authenticated
using (
  owner_id = (select auth.uid())
  or is_published = true
  or (shared_room_id is not null and public.is_media_room_member(shared_room_id, (select auth.uid())))
);

drop policy if exists "media library owner insert private" on public.media_library;
create policy "media library owner insert private"
on public.media_library for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and shared_room_id is null
  and is_published = false
  and (
    (source_type = 'upload' and storage_path is not null and online_url is null)
    or (source_type = 'link' and online_url like 'https://%' and storage_path is null)
  )
);

drop policy if exists "media library owner update" on public.media_library;
create policy "media library owner update"
on public.media_library for update to authenticated
using (owner_id = (select auth.uid()))
with check (
  owner_id = (select auth.uid())
  and (
    shared_room_id is null
    or public.is_media_room_member(shared_room_id, (select auth.uid()))
  )
  and (
    (source_type = 'upload' and storage_path is not null)
    or (source_type = 'link' and online_url like 'https://%' and storage_path is null)
  )
);

drop policy if exists "media library owner delete" on public.media_library;
create policy "media library owner delete"
on public.media_library for delete to authenticated
using (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.media_library to authenticated;

-- Private bucket. Set the Supabase project-wide Storage file limit to at least 1 GiB too.
-- Supabase Free projects cannot raise that global limit above 50 MB; a paid plan is required for 1 GiB uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media-library', 'media-library', false, 1073741824,
  array['video/mp4','video/webm','video/ogg','audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav','audio/aac','audio/flac']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Files are stored as <auth-user-uuid>/<random-id>-<filename>.
drop policy if exists "media library upload own folder" on storage.objects;
create policy "media library upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'media-library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "media library read owner or shared room" on storage.objects;
create policy "media library read owner or shared room"
on storage.objects for select to authenticated
using (
  bucket_id = 'media-library'
  and exists (
    select 1 from public.media_library ml
    where ml.storage_path = storage.objects.name
      and (
        ml.owner_id = (select auth.uid())
        or (ml.shared_room_id is not null and public.is_media_room_member(ml.shared_room_id, (select auth.uid())))
      )
  )
);

drop policy if exists "media library delete own folder" on storage.objects;
create policy "media library delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'media-library'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- No public SELECT policy and no UPDATE/UPSERT policy are created for this bucket.
