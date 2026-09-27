-- 「RLSを自動でオン」の設定で作られた関数を、外(API)から呼べないようにする（セキュリティ診断 0028/0029 のすすめどおり）
revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
