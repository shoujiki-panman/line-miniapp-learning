-- Edge Function（service_role）が visits に書けるようにする。新しいプロジェクトでは表を作っても自動で権限が付かない
-- 画面側（anon / authenticated）には付けない。触れるのはサーバーだけ
grant select, insert on table public.visits to service_role;
