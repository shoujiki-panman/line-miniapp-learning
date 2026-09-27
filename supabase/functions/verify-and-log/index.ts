// ミニアプリから届いたIDトークンをLINEに確かめてもらい、本物なら visits に1行入れる。
// 画面から届く名前やユーザーIDは信じない。信じるのは、LINEが「本物」と返した中身だけ。
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'jsr:@supabase/supabase-js@2/cors';

// 開発用ミニアプリのチャネルID（LIFF ID の「-」より前）。公開情報なので秘密ではない
const LINE_CHANNEL_ID = '2011762005';

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  // ブラウザから呼ぶための事前確認（CORS）
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  const { idToken } = await req.json().catch(() => ({}));
  if (typeof idToken !== 'string' || idToken === '') {
    return json({ error: 'idToken is required' }, 400);
  }

  // LINE公式の「IDトークンを検証する」API
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: LINE_CHANNEL_ID }),
  });
  const verified = await verifyRes.json();
  if (!verifyRes.ok) {
    // 期限切れ・別のチャネル宛て・改ざんなどはここで止まる
    return json({ error: 'invalid id token', detail: verified.error_description }, 401);
  }

  // RLSを通り抜けられる鍵はサーバーの中でだけ使う
  const secretKey = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')!)['default'];
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey);

  const { error } = await supabaseAdmin.from('visits').insert({
    line_user_id: verified.sub,
    display_name: verified.name ?? null,
  });
  if (error) {
    return json({ error: 'db insert failed' }, 500);
  }

  const { count } = await supabaseAdmin
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('line_user_id', verified.sub);

  return json({ ok: true, name: verified.name ?? null, visits: count ?? null }, 200);
});
