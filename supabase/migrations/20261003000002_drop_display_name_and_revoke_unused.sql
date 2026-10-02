-- 記録に個人情報を書かない。表示名は持たず、LINEのユーザーIDだけにする
alter table public.visits drop column display_name;

-- 画面側（anon / authenticated）に残っていた、使わない権限（表を空にする等）を外す
revoke truncate, references, trigger on table public.visits from anon, authenticated;
