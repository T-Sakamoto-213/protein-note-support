#!/usr/bin/env node
/**
 * 計算ツールと解説ページを生成する
 *
 * ■ なぜ増やすか
 * 食品成分表654ページは「◯◯のたんぱく質は何g」には強いが、
 * 「PFC 計算」「カロリー 計算」「たんぱく質 記録」のような
 * 目的から入る検索の受け皿が無かった。実測でこうなっていた。
 *
 *   たんぱく質（ひらがな） … 全1,568ページ中4枚にしか存在しない
 *   PFC / カロリー / ダイエット / 体重 … title・h1 に持つページが0
 *
 * ツールは被リンクが付きやすく、成分表への内部リンク元にもなる。
 *
 * ■ 薬機法・景表法
 * 「痩せる」「脂肪が落ちる」「筋肉がつく」は書かない。
 * 書くのは計算の手順と根拠だけ。減量・増量は「摂取カロリーの設定」という
 * 事実の話として扱い、効果は一切保証しない。
 * 免責は主張と同じ大きさで直下に置く（打ち消し表示の要件）。
 *
 * ■ 計算はすべてブラウザ内で完結させる
 * 体重・年齢は機微な情報なので送信しない。プライバシーポリシーの
 * 記述を増やさずに済み、ユーザーにもそう明示できる。
 *
 * 実行: node tools/generate-tools.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const SITE = 'https://protein-note.theslopebook.jp';
const GA_ID = 'G-SD50LR5JYC';
const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6748221439';

const DISCLAIMER =
  'この数値はあくまで推定値です。個人差があり、効果や結果を保証するものではありません。年齢・性別・体組成・持病・妊娠授乳の有無などによって適切な量は変わります。治療中の方、腎機能に不安のある方は、必ず医師・管理栄養士にご相談ください。';

const NOTATION_NOTE =
  '本サイトは日本食品標準成分表の表記に合わせて「たんぱく質」と記載しています。「タンパク質」「蛋白質」と同じ意味です。';

const ORGANIZATION_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'プロテインノート',
  url: SITE,
  logo: `${SITE}/images/icon-180.png`,
};

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layout({ title, description, canonicalPath, breadcrumb, body, depth = 1, jsonLd = [], inlineScript = '' }) {
  const up = '../'.repeat(depth);
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumb.map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: b.name,
      item: `${SITE}${b.path}`,
    })),
  };

  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${SITE}${canonicalPath}" />
    <meta property="og:site_name" content="プロテインノート" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/images/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${SITE}${canonicalPath}" />
    <meta property="og:type" content="article" />
    <meta property="og:locale" content="ja_JP" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" href="${up}favicon.ico" sizes="32x32" />
    <link rel="icon" href="${up}images/icon-96.png" type="image/png" sizes="96x96" />
    <link rel="apple-touch-icon" href="${up}images/icon-180.png" />
    <link rel="stylesheet" href="${up}css/style.css" />
    <link rel="stylesheet" href="${up}css/lp.css" />
    <link rel="stylesheet" href="${up}css/foods.css" />

    <script type="application/ld+json">
${JSON.stringify(crumbLd, null, 2)}
    </script>
${jsonLd
  .filter(Boolean)
  .map((o) => `    <script type="application/ld+json">\n${JSON.stringify(o, null, 2)}\n    </script>`)
  .join('\n')}
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${GA_ID}');
    </script>
  </head>
  <body>
    <header class="site-header">
      <div class="inner">
        <a href="${up}" class="logo">
          <img src="${up}images/icon-96.png" alt="プロテインノート" width="32" height="32" />
          Protein Note
        </a>
        <nav>
          <a href="${up}foods/">食品成分表</a>
          <a href="${up}tools/">計算ツール</a>
          <a href="${up}guide/">使い方ガイド</a>
          <a href="${up}faq.html">よくある質問</a>
          <a href="${up}">ホーム</a>
        </nav>
      </div>
    </header>

    <main class="page-content">
${body}
    </main>

    <footer class="site-footer">
      <div class="inner">
        <nav>
          <a href="${up}foods/">食品成分表</a>
          <a href="${up}tools/">計算ツール</a>
          <a href="${up}guide/">使い方ガイド</a>
          <a href="${up}faq.html">よくある質問</a>
          <a href="${up}support.html">サポート</a>
          <a href="${up}privacy.html">プライバシーポリシー</a>
          <a href="${up}terms.html">利用規約</a>
        </nav>
        <p class="copyright">© THE SLOPE BOOK</p>
      </div>
    </footer>
${inlineScript}
  </body>
</html>
`;
}

function ctaBlock() {
  // 食品ページ（generate-foods.mjs の ctaBlock）と同じ見た目に揃える
  return `      <div class="mid-cta">
        <p>毎日の記録は、プロテインノートで。基本機能は無料です。</p>
        <a href="${APP_STORE_URL}" class="store-badge" target="_blank" rel="noopener noreferrer" data-cta="tools">
          <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/ja-jp?size=250x83" alt="App Storeからダウンロード" width="157" height="54" loading="lazy" />
        </a>
      </div>`;
}

function faqLd(entries) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: { '@type': 'Answer', text: e.a },
    })),
  };
}

function faqSection(entries) {
  return `      <h2>よくある質問</h2>
      <div class="food-faq">
${entries
  .map(
    (e) => `        <div class="food-faq-item">
          <h3>${esc(e.q)}</h3>
          <p>${esc(e.a)}</p>
        </div>`,
  )
  .join('\n')}
      </div>`;
}

// ===========================================================================
// 1. カロリー計算（1日の消費カロリー＝TDEE）
// ===========================================================================

function calorieCalculator() {
  const faq = [
    {
      q: '1日に必要なカロリーはどうやって計算しますか？',
      a: 'まず基礎代謝量（安静時に消費するエネルギー）を身長・体重・年齢・性別から求め、それに活動量に応じた係数を掛けて1日の消費カロリー（TDEE）を算出します。本ページではハリス・ベネディクト式の改訂版を使っています。',
    },
    {
      q: '基礎代謝量とTDEEの違いは何ですか？',
      a: '基礎代謝量は横になって何もしない状態で消費するエネルギーです。TDEE（total daily energy expenditure）は、そこに日常の活動や運動による消費を加えた1日の合計です。食事の目安に使うのはTDEEのほうです。',
    },
    {
      q: '減量したい場合は何kcalにすればよいですか？',
      a: '一般に、消費カロリーより摂取カロリーが少ない状態が続くと体重は減ります。急激な制限は栄養不足につながるため、TDEEから15〜20%程度を引いた値が目安として使われます。適切な設定は個人差が大きいため、医師・管理栄養士にご相談ください。',
    },
    {
      q: '計算した内容は送信されますか？',
      a: '送信されません。計算はすべてブラウザの中で行われ、入力した身長・体重・年齢がサーバーに送られることはありません。',
    },
  ];

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">計算ツール</a> › <span>カロリー計算</span></nav>
      <h1>1日の必要カロリー計算</h1>
      <p class="support-lead">身長・体重・年齢・性別・活動量から、1日の消費カロリー（TDEE）と基礎代謝量を計算します。減量・維持・増量それぞれの目安も表示します。登録不要で、入力した内容が送信されることはありません。</p>

      <form class="calc-form" id="calc">
        <div class="calc-field">
          <label for="sex">性別</label>
          <select id="sex">
            <option value="male">男性</option>
            <option value="female">女性</option>
          </select>
        </div>
        <div class="calc-field">
          <label for="age">年齢</label>
          <input type="number" id="age" value="30" min="15" max="100" inputmode="numeric" />
        </div>
        <div class="calc-field">
          <label for="height">身長（cm）</label>
          <input type="number" id="height" value="170" min="120" max="230" inputmode="decimal" />
        </div>
        <div class="calc-field">
          <label for="weight">体重（kg）</label>
          <input type="number" id="weight" value="60" min="30" max="200" inputmode="decimal" />
        </div>
        <div class="calc-field">
          <label for="activity">活動量</label>
          <select id="activity">
            <option value="1.2">ほぼ運動なし（座り仕事中心）</option>
            <option value="1.375">軽い運動（週1〜3回）</option>
            <option value="1.55" selected>中程度（週3〜5回）</option>
            <option value="1.725">ハード（週6〜7回）</option>
            <option value="1.9">非常にハード（1日2回のトレーニング等）</option>
          </select>
        </div>
      </form>

      <div class="calc-result">
        <p class="calc-result-label">1日の消費カロリー（TDEE）</p>
        <p class="calc-result-value"><span id="tdee">—</span> kcal</p>
        <p class="calc-result-sub">基礎代謝量 <span id="bmr">—</span> kcal に活動量を掛けて算出</p>
      </div>

      <div class="table-wrap">
        <table class="food-table">
          <thead><tr><th>目的</th><th>1日の摂取カロリーの目安</th></tr></thead>
          <tbody>
            <tr><th>減量したい</th><td><span id="cut">—</span> kcal（TDEE −20%）</td></tr>
            <tr><th>体重を維持したい</th><td><span id="keep">—</span> kcal（TDEEと同じ）</td></tr>
            <tr><th>増量したい</th><td><span id="bulk">—</span> kcal（TDEE +10%）</td></tr>
          </tbody>
        </table>
      </div>
      <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
      <noscript><p class="food-disclaimer">お使いの環境ではJavaScriptが無効のため、自動計算は動作しません。下の「計算式」から手計算できます。</p></noscript>

      <h2>計算式</h2>
      <p>基礎代謝量はハリス・ベネディクト式の改訂版（Roza &amp; Shizgal, 1984）で求めています。</p>
      <div class="table-wrap">
        <table class="food-table">
          <tbody>
            <tr><th>男性</th><td>88.362 + 13.397 × 体重kg + 4.799 × 身長cm − 5.677 × 年齢</td></tr>
            <tr><th>女性</th><td>447.593 + 9.247 × 体重kg + 3.098 × 身長cm − 4.330 × 年齢</td></tr>
          </tbody>
        </table>
      </div>
      <p>これに活動量の係数（1.2〜1.9）を掛けたものがTDEEです。</p>

${faqSection(faq)}

      <section class="food-source">
        <h2>出典と注意事項</h2>
        <p>計算式は Roza AM, Shizgal HM. "The Harris Benedict equation reevaluated" (Am J Clin Nutr, 1984) に基づきます。活動量の係数は同式で一般に用いられる区分を使用しています。エネルギー必要量の考え方は厚生労働省『日本人の食事摂取基準（2025年版）』を参照しています。</p>
        <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
        <p class="food-disclaimer">本ページは栄養に関する情報提供を目的としたもので、医療上の助言ではありません。特定の疾病の予防・治療・改善を目的とするものではありません。</p>
      </section>

      <h2>次にやること</h2>
      <ul class="food-links">
        <li><a href="pfc-calculator.html">PFCバランスを計算する</a> <span class="food-links-note">算出したカロリーをたんぱく質・脂質・炭水化物に配分</span></li>
        <li><a href="protein-calculator.html">たんぱく質の必要量を計算する</a></li>
        <li><a href="../foods/">食品成分表で実際の食品を調べる</a></li>
      </ul>

${ctaBlock()}

      <nav class="guide-nav"><a href="./">← 計算ツール一覧</a><a href="pfc-calculator.html">PFCバランス計算 →</a></nav>`;

  const script = `    <script>
      (function () {
        var ids = ['sex', 'age', 'height', 'weight', 'activity'];
        function n(id) { return parseFloat(document.getElementById(id).value); }
        function calc() {
          var age = n('age'), h = n('height'), w = n('weight'), act = n('activity');
          if (!(age > 0 && h > 0 && w > 0 && act > 0)) return;
          var male = document.getElementById('sex').value === 'male';
          var bmr = male
            ? 88.362 + 13.397 * w + 4.799 * h - 5.677 * age
            : 447.593 + 9.247 * w + 3.098 * h - 4.330 * age;
          var tdee = bmr * act;
          var r = function (v) { return Math.round(v).toLocaleString('ja-JP'); };
          document.getElementById('bmr').textContent = r(bmr);
          document.getElementById('tdee').textContent = r(tdee);
          document.getElementById('cut').textContent = r(tdee * 0.8);
          document.getElementById('keep').textContent = r(tdee);
          document.getElementById('bulk').textContent = r(tdee * 1.1);
        }
        ids.forEach(function (id) {
          var el = document.getElementById(id);
          el.addEventListener('input', calc);
          el.addEventListener('change', calc);
        });
        calc();
      })();
    </script>`;

  return layout({
    title: 'カロリー計算｜1日の必要カロリーと基礎代謝を計算 - プロテインノート',
    description:
      '身長・体重・年齢・性別・活動量から1日の消費カロリー（TDEE）と基礎代謝量を計算。減量・維持・増量それぞれの摂取カロリーの目安も表示します。ハリス・ベネディクト式改訂版を使用。登録不要・無料。',
    canonicalPath: '/tools/calorie-calculator.html',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '計算ツール', path: '/tools/' },
      { name: 'カロリー計算', path: '/tools/calorie-calculator.html' },
    ],
    body,
    jsonLd: [faqLd(faq), ORGANIZATION_LD],
    inlineScript: script,
  });
}

// ===========================================================================
// 2. PFCバランス計算
// ===========================================================================

function pfcCalculator() {
  const faq = [
    {
      q: 'PFCバランスとは何ですか？',
      a: 'P（protein＝たんぱく質）、F（fat＝脂質）、C（carbohydrate＝炭水化物）の3つを、摂取エネルギーに占める割合で表したものです。たんぱく質と炭水化物は1gあたり4kcal、脂質は1gあたり9kcalとして換算します。',
    },
    {
      q: 'PFCの比率はどれくらいが目安ですか？',
      a: '厚生労働省『日本人の食事摂取基準（2025年版）』では、エネルギー産生栄養素バランスの目標量として、たんぱく質13〜20%、脂質20〜30%、炭水化物50〜65%（いずれも1歳以上）が示されています。運動習慣や目的によって、この範囲内で配分を変える方法がとられます。',
    },
    {
      q: 'たんぱく質は何gにすればよいですか？',
      a: '体重1kgあたりで決める方法が一般的です。運動習慣がない場合は1.0g/kg前後、トレーニングをしている場合は1.4〜2.0g/kg程度が目安として使われます。本ページでは活動量と目的から自動で係数を選んでいます。',
    },
    {
      q: '計算した内容は送信されますか？',
      a: '送信されません。計算はすべてブラウザの中で行われ、入力した体重などがサーバーに送られることはありません。',
    },
  ];

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">計算ツール</a> › <span>PFCバランス計算</span></nav>
      <h1>PFCバランス計算</h1>
      <p class="support-lead">1日の摂取カロリーと目的から、たんぱく質（P）・脂質（F）・炭水化物（C）をそれぞれ何g摂ればよいかを計算します。カロリーが分からない場合は<a href="calorie-calculator.html">カロリー計算</a>で先に求めてください。登録不要で、入力した内容が送信されることはありません。</p>

      <form class="calc-form" id="calc">
        <div class="calc-field">
          <label for="kcal">1日の摂取カロリー（kcal）</label>
          <input type="number" id="kcal" value="2000" min="800" max="6000" inputmode="numeric" />
        </div>
        <div class="calc-field">
          <label for="weight">体重（kg）</label>
          <input type="number" id="weight" value="60" min="30" max="200" inputmode="decimal" />
        </div>
        <div class="calc-field">
          <label for="goal">目的</label>
          <select id="goal">
            <option value="keep">体重を維持したい</option>
            <option value="cut">減量したい</option>
            <option value="bulk">筋肉をつけたい</option>
          </select>
        </div>
        <div class="calc-field">
          <label for="train">運動習慣</label>
          <select id="train">
            <option value="none">ほぼ運動なし</option>
            <option value="light">軽い運動（週1〜3回）</option>
            <option value="mid" selected>中程度（週3〜5回）</option>
            <option value="hard">ハード（週6回以上）</option>
          </select>
        </div>
      </form>

      <div class="table-wrap">
        <table class="food-table">
          <thead><tr><th>栄養素</th><th>1日の目安</th><th>エネルギー比</th></tr></thead>
          <tbody>
            <tr><th>P たんぱく質</th><td><strong><span id="p">—</span> g</strong></td><td><span id="pp">—</span>%</td></tr>
            <tr><th>F 脂質</th><td><strong><span id="f">—</span> g</strong></td><td><span id="fp">—</span>%</td></tr>
            <tr><th>C 炭水化物</th><td><strong><span id="c">—</span> g</strong></td><td><span id="cp">—</span>%</td></tr>
          </tbody>
        </table>
      </div>
      <p class="calc-result-sub">たんぱく質は体重1kgあたり <span id="gkg">—</span> g で算出しています。</p>
      <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
      <noscript><p class="food-disclaimer">お使いの環境ではJavaScriptが無効のため、自動計算は動作しません。下の「計算の考え方」から手計算できます。</p></noscript>

      <h2>計算の考え方</h2>
      <p>次の順番で決めています。</p>
      <ol class="steps">
        <li>たんぱく質を、体重1kgあたりの係数（下表）から決める</li>
        <li>脂質を、総エネルギーの25%（減量時は20%）として決める</li>
        <li>残りのエネルギーを炭水化物に割り当てる</li>
      </ol>
      <div class="table-wrap">
        <table class="food-table">
          <thead><tr><th>運動習慣</th><th>維持</th><th>減量</th><th>筋肉をつけたい</th></tr></thead>
          <tbody>
            <tr><th>ほぼ運動なし</th><td>1.0g</td><td>1.2g</td><td>1.2g</td></tr>
            <tr><th>軽い運動（週1〜3回）</th><td>1.2g</td><td>1.4g</td><td>1.4g</td></tr>
            <tr><th>中程度（週3〜5回）</th><td>1.4g</td><td>1.6g</td><td>1.6g</td></tr>
            <tr><th>ハード（週6回以上）</th><td>1.6g</td><td>1.8g</td><td>2.0g</td></tr>
          </tbody>
        </table>
      </div>
      <p>たんぱく質と炭水化物は1gあたり4kcal、脂質は1gあたり9kcalとして換算しています。</p>
      <p class="food-disclaimer">${esc(NOTATION_NOTE)}</p>

${faqSection(faq)}

      <section class="food-source">
        <h2>出典と注意事項</h2>
        <p>エネルギー産生栄養素バランスの考え方は厚生労働省『日本人の食事摂取基準（2025年版）』、体重1kgあたりのたんぱく質量は ISSN Position Stand: protein and exercise (Jäger et al., 2017, J Int Soc Sports Nutr) を参照しています。</p>
        <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
        <p class="food-disclaimer">本ページは栄養に関する情報提供を目的としたもので、医療上の助言ではありません。特定の疾病の予防・治療・改善を目的とするものではありません。</p>
      </section>

      <h2>次にやること</h2>
      <ul class="food-links">
        <li><a href="../foods/protein-ranking.html">たんぱく質が多い食品ランキング100</a> <span class="food-links-note">算出したPを満たす食品を探す</span></li>
        <li><a href="../foods/">食品成分表（654品目）</a></li>
        <li><a href="../guide/protein-tracking.html">たんぱく質の記録方法</a></li>
      </ul>

${ctaBlock()}

      <nav class="guide-nav"><a href="calorie-calculator.html">← カロリー計算</a><a href="../foods/">食品成分表 →</a></nav>`;

  const script = `    <script>
      (function () {
        var G = {
          none: { keep: 1.0, cut: 1.2, bulk: 1.2 },
          light: { keep: 1.2, cut: 1.4, bulk: 1.4 },
          mid: { keep: 1.4, cut: 1.6, bulk: 1.6 },
          hard: { keep: 1.6, cut: 1.8, bulk: 2.0 }
        };
        function calc() {
          var kcal = parseFloat(document.getElementById('kcal').value);
          var w = parseFloat(document.getElementById('weight').value);
          var goal = document.getElementById('goal').value;
          var train = document.getElementById('train').value;
          if (!(kcal > 0 && w > 0)) return;
          var gkg = G[train][goal];
          var p = w * gkg;
          var fatRatio = goal === 'cut' ? 0.20 : 0.25;
          var f = (kcal * fatRatio) / 9;
          var c = (kcal - p * 4 - f * 9) / 4;
          if (c < 0) c = 0;
          var set = function (id, v) { document.getElementById(id).textContent = Math.round(v); };
          set('p', p); set('f', f); set('c', c);
          var total = p * 4 + f * 9 + c * 4;
          set('pp', (p * 4 / total) * 100);
          set('fp', (f * 9 / total) * 100);
          set('cp', (c * 4 / total) * 100);
          document.getElementById('gkg').textContent = gkg.toFixed(1);
        }
        ['kcal', 'weight', 'goal', 'train'].forEach(function (id) {
          var el = document.getElementById(id);
          el.addEventListener('input', calc);
          el.addEventListener('change', calc);
        });
        calc();
      })();
    </script>`;

  return layout({
    title: 'PFCバランス計算｜たんぱく質・脂質・炭水化物のグラム数を計算 - プロテインノート',
    description:
      '1日の摂取カロリーと体重・目的から、PFC（たんぱく質・脂質・炭水化物）を何g摂ればよいかを計算します。減量・維持・増量別に対応。厚生労働省『日本人の食事摂取基準（2025年版）』を参照。登録不要・無料。',
    canonicalPath: '/tools/pfc-calculator.html',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '計算ツール', path: '/tools/' },
      { name: 'PFCバランス計算', path: '/tools/pfc-calculator.html' },
    ],
    body,
    jsonLd: [faqLd(faq), ORGANIZATION_LD],
    inlineScript: script,
  });
}

// ===========================================================================
// 3. ツール一覧（ハブ）
// ===========================================================================

function toolsIndex() {
  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <span>計算ツール</span></nav>
      <h1>栄養計算ツール</h1>
      <p class="support-lead">1日に必要なカロリー・たんぱく質・PFCバランスを計算できます。すべて登録不要で、入力した内容がサーバーに送信されることはありません（計算はブラウザ内で完結します）。</p>

      <ul class="food-links food-links--grid">
        <li><a href="calorie-calculator.html">カロリー計算</a> <span class="food-links-note">身長・体重・年齢・活動量から1日の消費カロリー（TDEE）と基礎代謝を計算</span></li>
        <li><a href="pfc-calculator.html">PFCバランス計算</a> <span class="food-links-note">摂取カロリーをたんぱく質・脂質・炭水化物のグラム数に配分</span></li>
        <li><a href="protein-calculator.html">たんぱく質必要量の計算</a> <span class="food-links-note">体重・運動量・目的から1日のたんぱく質の目安量を計算</span></li>
      </ul>

      <h2>使う順番</h2>
      <ol class="steps">
        <li><a href="calorie-calculator.html">カロリー計算</a>で1日の消費カロリーを出す</li>
        <li>目的（減量・維持・増量）に応じて摂取カロリーを決める</li>
        <li><a href="pfc-calculator.html">PFCバランス計算</a>でたんぱく質・脂質・炭水化物のグラム数に配分する</li>
        <li><a href="../foods/">食品成分表</a>で、そのグラム数を実際の食品でどう満たすか調べる</li>
      </ol>

      <section class="food-source">
        <h2>注意事項</h2>
        <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
        <p class="food-disclaimer">${esc(NOTATION_NOTE)}</p>
      </section>

${ctaBlock()}

      <nav class="guide-nav"><a href="../foods/">← 食品成分表</a><a href="../guide/">使い方ガイド →</a></nav>`;

  return layout({
    title: '栄養計算ツール｜カロリー・PFC・たんぱく質必要量の計算 - プロテインノート',
    description:
      '1日の必要カロリー（TDEE）・PFCバランス・たんぱく質必要量を計算できる無料ツール。体重や活動量を入れるだけ。登録不要、入力内容は送信されません。厚生労働省『日本人の食事摂取基準（2025年版）』を参照。',
    canonicalPath: '/tools/',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '計算ツール', path: '/tools/' },
    ],
    body,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: '栄養計算ツール',
        url: `${SITE}/tools/`,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'カロリー計算', url: `${SITE}/tools/calorie-calculator.html` },
            { '@type': 'ListItem', position: 2, name: 'PFCバランス計算', url: `${SITE}/tools/pfc-calculator.html` },
            { '@type': 'ListItem', position: 3, name: 'たんぱく質必要量の計算', url: `${SITE}/tools/protein-calculator.html` },
          ],
        },
      },
      ORGANIZATION_LD,
    ],
  });
}

// ===========================================================================
// 4. たんぱく質の記録方法（解説）
// ===========================================================================

function proteinTracking() {
  const faq = [
    {
      q: 'たんぱく質はどうやって記録すればよいですか？',
      a: '食べたものの重量（g）と、その食品の100gあたりのたんぱく質量が分かれば計算できます。「100gあたりの値 × 食べた重量 ÷ 100」です。毎回この計算をするのは手間なので、記録アプリを使うか、よく食べるものの数値を控えておく方法がとられます。',
    },
    {
      q: '記録が続かないのですが、どうすればよいですか？',
      a: '毎食すべてを完璧に記録しようとすると続きません。まず1日1食だけ、あるいはよく食べるもの数品だけを記録する方法があります。記録アプリの多くは、よく使う組み合わせを保存してワンタップで入力できる機能を備えています。',
    },
    {
      q: '外食や惣菜のたんぱく質はどう調べますか？',
      a: '市販品は栄養成分表示の確認が確実です。表示がない外食では、主な食材の重量を見当づけて、食品成分表の値から概算する方法があります。本サイトの食品成分表には、日本食品標準成分表に収載のある惣菜・料理も掲載しています。',
    },
    {
      q: '1日に何g摂ればよいですか？',
      a: '体重1kgあたりで決める方法が一般的です。運動習慣がない場合は1.0g/kg前後、トレーニングをしている場合は1.4〜2.0g/kg程度が目安として使われます。当サイトのたんぱく質必要量の計算で算出できます。',
    },
  ];

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">使い方ガイド</a> › <span>たんぱく質の記録方法</span></nav>
      <h1>たんぱく質の記録方法</h1>
      <p class="support-lead">食べたもののたんぱく質量を把握する手順と、記録を続けるためのやり方をまとめています。計算の考え方は道具を問わず同じなので、手書き・表計算・アプリのいずれでも使えます。</p>

      <h2>1. 計算のしかた</h2>
      <p>たんぱく質量は、食品の100gあたりの値と食べた重量から求めます。</p>
      <div class="table-wrap">
        <table class="food-table">
          <tbody>
            <tr><th>計算式</th><td>100gあたりのたんぱく質量 × 食べた重量(g) ÷ 100</td></tr>
            <tr><th>例）鶏卵1個(50g)</th><td>12.2g × 50 ÷ 100 = 6.1g</td></tr>
            <tr><th>例）ごはん1杯(150g)</th><td>2.5g × 150 ÷ 100 = 3.8g</td></tr>
          </tbody>
        </table>
      </div>
      <p>100gあたりの値は<a href="../foods/">食品成分表</a>で調べられます。654品目すべて、文部科学省が公表する日本食品標準成分表の収載値です。</p>

      <h2>2. 記録する方法の選び方</h2>
      <div class="table-wrap">
        <table class="food-table">
          <thead><tr><th>方法</th><th>向いている場合</th><th>手間</th></tr></thead>
          <tbody>
            <tr><th>手書き・メモ</th><td>食べるものが毎日ほぼ同じ</td><td>計算を自分でする</td></tr>
            <tr><th>表計算ソフト</th><td>自分で集計・グラフ化したい</td><td>初期設定が必要</td></tr>
            <tr><th>記録アプリ</th><td>食べるものが日によって変わる</td><td>検索して選ぶだけ</td></tr>
          </tbody>
        </table>
      </div>

      <h2>3. 続けるためのこつ</h2>
      <ol class="steps">
        <li><strong>全部を記録しようとしない。</strong>まず1日1食、あるいは主食と主菜だけから始める方法があります</li>
        <li><strong>よく食べるものを固定する。</strong>朝食が毎日同じなら、その組み合わせを一度登録すれば以降は選ぶだけで済みます</li>
        <li><strong>記録する時間を決める。</strong>食後すぐ、あるいは1日の終わりにまとめて、と決めておくと忘れにくくなります</li>
        <li><strong>抜けた日を気にしない。</strong>数日分の記録が抜けても、傾向を見るぶんには支障ありません</li>
      </ol>

      <h2>4. 1日の目安量を決める</h2>
      <p>記録する前に、目安量が決まっていないと多いのか少ないのか判断できません。体重1kgあたりの係数から求める方法が一般的です。</p>
      <ul class="food-links">
        <li><a href="../tools/protein-calculator.html">たんぱく質必要量の計算</a> <span class="food-links-note">体重・運動量・目的から1日の目安量を算出</span></li>
        <li><a href="../tools/pfc-calculator.html">PFCバランス計算</a> <span class="food-links-note">脂質・炭水化物も含めた配分を決める</span></li>
        <li><a href="../tools/calorie-calculator.html">カロリー計算</a> <span class="food-links-note">1日の消費カロリーから決める</span></li>
      </ul>

      <h2>5. プロテインノートでの記録</h2>
      <p>本サイトを運営しているプロテインノートは、たんぱく質を中心に食事とトレーニングを記録するiOSアプリです。記録の方法は次の4つがあります。</p>
      <div class="table-wrap">
        <table class="food-table">
          <thead><tr><th>方法</th><th>内容</th></tr></thead>
          <tbody>
            <tr><th>検索して記録</th><td>654品目の食品データベースから選んで重量を入れる</td></tr>
            <tr><th>写真で記録</th><td>食事の写真から食品と分量をAIが推定する</td></tr>
            <tr><th>音声で記録</th><td>食べたものを話して記録する</td></tr>
            <tr><th>ワンタップ記録</th><td>よく食べる組み合わせを保存し、次回から1タップで記録する</td></tr>
          </tbody>
        </table>
      </div>
      <p>詳しくは<a href="meal-logging.html">食事記録の使い方</a>をご覧ください。</p>

${faqSection(faq)}

      <section class="food-source">
        <h2>出典と注意事項</h2>
        <p>食品の栄養成分値は文部科学省『日本食品標準成分表（八訂）増補2023年』の収載値です。1日の目安量の考え方は厚生労働省『日本人の食事摂取基準（2025年版）』を参照しています。</p>
        <p class="food-disclaimer">${esc(NOTATION_NOTE)}</p>
        <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
        <p class="food-disclaimer">本ページは栄養に関する情報提供を目的としたもので、医療上の助言ではありません。特定の疾病の予防・治療・改善を目的とするものではありません。</p>
      </section>

${ctaBlock()}

      <nav class="guide-nav"><a href="./">← 使い方ガイド</a><a href="../foods/">食品成分表 →</a></nav>`;

  return layout({
    title: 'たんぱく質の記録方法｜計算式・続けるこつ・アプリの使い分け - プロテインノート',
    description:
      'たんぱく質の摂取量を記録する手順を解説。100gあたりの値と重量から求める計算式、手書き・表計算・アプリの使い分け、記録が続かないときの対処、1日の目安量の決め方まで。日本食品標準成分表に基づく654品目の成分表付き。',
    canonicalPath: '/guide/protein-tracking.html',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '使い方ガイド', path: '/guide/' },
      { name: 'たんぱく質の記録方法', path: '/guide/protein-tracking.html' },
    ],
    body,
    jsonLd: [
      faqLd(faq),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'たんぱく質の記録方法',
        description: 'たんぱく質の摂取量を記録する手順、計算式、続けるためのこつ。',
        author: { '@type': 'Organization', name: 'プロテインノート' },
        publisher: ORGANIZATION_LD,
        inLanguage: 'ja',
      },
      ORGANIZATION_LD,
    ],
  });
}

// ===========================================================================

const OUT = [
  ['tools/index.html', toolsIndex()],
  ['tools/calorie-calculator.html', calorieCalculator()],
  ['tools/pfc-calculator.html', pfcCalculator()],
  ['guide/protein-tracking.html', proteinTracking()],
];

for (const [rel, html] of OUT) {
  const p = path.join(DOCS, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf8');
  console.log(`  生成 ${rel}`);
}
console.log(`\n${OUT.length}ページを生成しました`);
