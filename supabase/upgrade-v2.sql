-- Laddu's World v2 upgrade. Run AFTER schema.sql (and media-library.sql). Safe to re-run.

-- 1) Room roles + shared queue ------------------------------------------------
alter table public.room_members add column if not exists role text not null default 'member' check (role in ('member','mod'));

create table if not exists public.song_library (        -- curated by you (SQL editor / dashboard); users cannot insert
  id uuid primary key default gen_random_uuid(),
  video_id text not null unique check (char_length(video_id) = 11),
  title text not null,
  artist text,
  movie text,
  thumbnail text,
  language text not null default 'tamil',
  created_at timestamptz not null default now()
);

create table if not exists public.room_queue (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  video_id text not null check (char_length(video_id) = 11),
  title text not null,
  channel text,
  thumbnail text,
  kind text not null default 'song' check (kind in ('song','video')),
  added_by uuid not null references auth.users(id) on delete cascade,
  added_by_name text,
  position bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint,
  created_at timestamptz not null default now()
);
create index if not exists room_queue_room_idx on public.room_queue(room_id, position);

-- 2) Room invites (friend -> room) -------------------------------------------
create table if not exists public.room_invites (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  from_id uuid not null references auth.users(id) on delete cascade,
  to_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  unique (room_id, to_id)
);

-- 3) RLS ------------------------------------------------------------------------
alter table public.song_library enable row level security;
alter table public.room_queue enable row level security;
alter table public.room_invites enable row level security;

drop policy if exists "song library readable" on public.song_library;
create policy "song library readable" on public.song_library for select to authenticated using (true);

drop policy if exists "queue readable by room" on public.room_queue;
create policy "queue readable by room" on public.room_queue for select to authenticated using (public.can_access_room(room_id, auth.uid()));
drop policy if exists "queue insert by member" on public.room_queue;
create policy "queue insert by member" on public.room_queue for insert to authenticated
  with check (added_by = auth.uid() and public.can_access_room(room_id, auth.uid()));
drop policy if exists "queue delete own or host" on public.room_queue;
create policy "queue delete own or host" on public.room_queue for delete to authenticated
  using (added_by = auth.uid() or exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));
drop policy if exists "queue reorder host" on public.room_queue;
create policy "queue reorder host" on public.room_queue for update to authenticated
  using (exists (select 1 from public.rooms r where r.id = room_id and r.host_id = auth.uid()));

drop policy if exists "invite parties read" on public.room_invites;
create policy "invite parties read" on public.room_invites for select to authenticated using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "member sends invite" on public.room_invites;
create policy "member sends invite" on public.room_invites for insert to authenticated
  with check (from_id = auth.uid() and public.can_access_room(room_id, auth.uid()));
drop policy if exists "invite parties delete" on public.room_invites;
create policy "invite parties delete" on public.room_invites for delete to authenticated using (from_id = auth.uid() or to_id = auth.uid());

-- 4) RPCs -----------------------------------------------------------------------
create or replace function public.respond_room_invite(p_invite_id uuid, p_accept boolean)
returns setof public.rooms language plpgsql security definer set search_path = '' as $$
declare inv public.room_invites; r public.rooms;
begin
  select * into inv from public.room_invites where id = p_invite_id and to_id = auth.uid() and status = 'pending';
  if inv.id is null then return; end if;
  if p_accept then
    insert into public.room_members (room_id, user_id) values (inv.room_id, auth.uid()) on conflict do nothing;
    update public.room_invites set status = 'accepted' where id = inv.id;
    select * into r from public.rooms where id = inv.room_id;
    return next r;
  else
    update public.room_invites set status = 'declined' where id = inv.id;
  end if;
end $$;
revoke all on function public.respond_room_invite(uuid, boolean) from public;
grant execute on function public.respond_room_invite(uuid, boolean) to authenticated;

-- Room list for "my rooms": hosted + joined, with member counts.
create or replace function public.my_rooms()
returns table (id uuid, name text, code text, visibility text, host_id uuid, created_at timestamptz, member_count bigint)
language sql stable security definer set search_path = '' as $$
  select r.id, r.name, r.code, r.visibility, r.host_id, r.created_at,
         (select count(*) from public.room_members m where m.room_id = r.id) + 1
  from public.rooms r
  where r.host_id = auth.uid() or exists (select 1 from public.room_members m where m.room_id = r.id and m.user_id = auth.uid())
  order by r.created_at desc;
$$;
revoke all on function public.my_rooms() from public;
grant execute on function public.my_rooms() to authenticated;

-- Host can change the join code (kicks nobody, but old codes stop working).
create or replace function public.regenerate_room_code(p_room_id uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if upper(p_code) !~ '^[A-Z0-9]{6,12}$' then raise exception 'Bad code'; end if;
  update public.rooms set code = upper(p_code) where id = p_room_id and host_id = auth.uid();
  return upper(p_code);
end $$;
revoke all on function public.regenerate_room_code(uuid, text) from public;
grant execute on function public.regenerate_room_code(uuid, text) to authenticated;

-- 5) Realtime (live friend-request badges, invites, queue) -----------------
do $$ begin
  begin alter publication supabase_realtime add table public.friendships; exception when others then null; end;
  begin alter publication supabase_realtime add table public.room_invites; exception when others then null; end;
  begin alter publication supabase_realtime add table public.room_queue;   exception when others then null; end;
end $$;

-- 6) Add Tamil songs to the shared library (examples of the insert shape) ---
-- insert into public.song_library (video_id, title, artist, movie, thumbnail)
-- values ('XXXXXXXXXXX', 'Song title', 'Singer', 'Movie', 'https://i.ytimg.com/vi/XXXXXXXXXXX/hqdefault.jpg');
