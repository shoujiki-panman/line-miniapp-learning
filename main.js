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

    app.replaceChildren(img, hello, note);
  })
  .catch((error) => {
    document.querySelector('#app').innerHTML = `
    <h1>create-liff-app</h1>
    <p>LIFF init failed.</p>
    <p><code>${error}</code></p>
    <a href="https://developers.line.biz/ja/docs/liff/" target="_blank" rel="noreferrer">
      LIFF Documentation
    </a>
  `;
  });
