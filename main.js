import './style.css';
import liff from '@line/liff';

const app = document.querySelector('#app');

liff
  .init({
    liffId: import.meta.env.VITE_LIFF_ID
  })
  .then(async () => {
    // LINEの中（LIFFブラウザ）では init の時点で自動ログインされる。
    // 外のブラウザで開いたときだけ、ここでログインへ送る。
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }

    const profile = await liff.getProfile();

    // 名前は利用者が自由に付けられる文字なので、HTMLとしてではなく文字として入れる
    const img = document.createElement('img');
    img.src = profile.pictureUrl ?? '';
    img.alt = '';
    img.width = 96;
    img.height = 96;
    img.style.borderRadius = '50%';

    const hello = document.createElement('h1');
    hello.textContent = `こんにちは、${profile.displayName}さん`;

    const note = document.createElement('p');
    note.textContent = 'この名前とアイコンは、LINEから受け取ったものです。';

    const visit = document.createElement('p');
    visit.textContent = 'サーバーに記録しています…';

    app.replaceChildren(img, hello, note, visit);

    // サーバーには名前ではなくIDトークンを送る。本物かどうかはサーバーがLINEに確かめる
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-and-log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: liff.getIDToken() })
    });
    const result = await res.json();
    visit.textContent = res.ok
      ? `サーバーがLINEに確かめて記録しました。${result.visits}回目の来訪です。`
      : `記録できませんでした（${res.status}: ${result.error}）`;
  })
  .catch((error) => {
    // エラー文も外から来る文字なので、HTMLとしてではなく文字として入れる
    const title = document.createElement('h1');
    title.textContent = 'create-liff-app';

    const failed = document.createElement('p');
    failed.textContent = 'LIFF init failed.';

    const code = document.createElement('code');
    code.textContent = String(error);
    const detail = document.createElement('p');
    detail.append(code);

    const docs = document.createElement('a');
    docs.href = 'https://developers.line.biz/ja/docs/liff/';
    docs.target = '_blank';
    docs.rel = 'noreferrer';
    docs.textContent = 'LIFF Documentation';

    app.replaceChildren(title, failed, detail, docs);
  });
