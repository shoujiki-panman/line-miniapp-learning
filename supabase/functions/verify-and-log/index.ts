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

  // idToken = 誰なのかを確かめる用、accessToken = 受付完了の通知を送る用
  const { idToken, accessToken } = await req.json().catch(() => ({}));
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

  // 表示名は保存しない。記録に要るのはLINEのユーザーIDだけ
  const { data: row, error } = await supabaseAdmin
    .from('visits')
    .insert({ line_user_id: verified.sub })
    .select('id')
    .single();
  if (error) {
    return json({ error: 'db insert failed' }, 500);
  }

  const { count } = await supabaseAdmin
    .from('visits')
    .select('*', { count: 'exact', head: true })
    .eq('line_user_id', verified.sub);

  // 記録できたら「受付完了」をサービスメッセージで届ける。届かなくても記録は成功のまま返す
  const notified = typeof accessToken === 'string' && accessToken !== ''
    ? await sendEntryConfirmed(accessToken, row.id)
    : 'skipped: no access token';

  return json({ ok: true, visits: count ?? null, notified }, 200);
});

// LINEミニアプリのサービスメッセージ（未認証では開発用チャネルからだけ送れる）
// 1. チャネルIDとチャネルシークレットで、15分だけ有効なチャネルアクセストークンをもらう
// 2. LIFFアクセストークンと引き換えに、この利用者あての通知トークンをもらう
// 3. コンソールで登録したテンプレートに値を入れて送る
async function sendEntryConfirmed(liffAccessToken: string, entryNumber: number): Promise<string> {
  const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET');
  if (!channelSecret) return 'skipped: LINE_CHANNEL_SECRET is not set';

  const tokenRes = await fetch('https://api.line.me/oauth2/v3/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: LINE_CHANNEL_ID,
      client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) return `failed: channel token ${tokenRes.status}`;
  const { access_token: channelAccessToken } = await tokenRes.json();

  const auth = { Authorization: `Bearer ${channelAccessToken}`, 'Content-Type': 'application/json' };

  const notifierRes = await fetch('https://api.line.me/message/v3/notifier/token', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ liffAccessToken }),
  });
  if (!notifierRes.ok) return `failed: notifier token ${notifierRes.status}`;
  const { notificationToken } = await notifierRes.json();

  const sendRes = await fetch('https://api.line.me/message/v3/notifier/send?target=service', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      templateName: 'entry_s_t_ja',
      notificationToken,
      params: {
        number: String(entryNumber),
        btn1_url: 'https://miniapp.line.me/2011762005-Ur1wYhF3',
      },
    }),
  });
  if (!sendRes.ok) return `failed: send ${sendRes.status} ${await sendRes.text()}`;
  return 'sent';
}
