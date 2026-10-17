-- Run ONCE in Supabase SQL editor (after schema.sql + upgrade-v2.sql).
-- Lets the room queue hold songs from non-YouTube audio APIs (JioSaavn / Audius / iTunes).
alter table public.room_queue drop constraint if exists room_queue_video_id_check;
alter table public.room_queue add column if not exists audio_url text;
alter table public.room_queue add column if not exists provider text;
alter table public.room_queue add constraint room_queue_audio_url_https check (audio_url is null or audio_url ~ '^https://');
alter table public.room_queue add constraint room_queue_video_id_len check (char_length(video_id) between 1 and 200);
