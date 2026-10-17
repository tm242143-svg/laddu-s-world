-- Laddu's World v4: unique usernames. Run once in Supabase SQL Editor.
-- 1) Give existing duplicate names a numeric suffix so the unique index can be created.
with d as (
  select id, display_name, row_number() over (partition by lower(display_name) order by created_at, id) rn
  from public.profiles
)
update public.profiles p set display_name = left(p.display_name, 34) || '_' || d.rn
from d where p.id = d.id and d.rn > 1;

create unique index if not exists profiles_display_name_unique on public.profiles (lower(display_name));

-- 2) Public availability check (works before login, used live on the sign-up form).
create or replace function public.username_available(p_name text)
returns boolean language sql security definer set search_path = '' stable as $$
  select not exists (select 1 from public.profiles where lower(display_name) = lower(trim(p_name)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- 3) Sign-up trigger: use the chosen username; if it is somehow taken, fail clearly (client also pre-checks).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare nm text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1), 'Viewer');
begin
  if exists (select 1 from public.profiles where lower(display_name) = lower(nm)) then
    raise exception 'USERNAME_TAKEN';
  end if;
  insert into public.profiles (id, display_name) values (new.id, left(nm, 40)) on conflict (id) do nothing;
  return new;
end;
$$;
