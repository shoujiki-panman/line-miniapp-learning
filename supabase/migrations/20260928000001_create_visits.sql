-- ミニアプリを開いた記録。LINEに本物と確かめてもらったIDトークンの中身だけを入れる
create table public.visits (
  id bigint generated always as identity primary key,
  line_user_id text not null,   -- IDトークンの sub（LINEのユーザーID）
  display_name text,            -- IDトークンの name
  visited_at timestamptz not null default now()
);

-- 画面からは直接触らせない。書き込みは Edge Function（service_role）だけ
alter table public.visits enable row level security;
