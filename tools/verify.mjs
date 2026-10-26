#!/usr/bin/env node
/**
 * 公開前の不変条件チェック（読み取り専用。何も書き換えない）
 *
 * ■ なぜ必要か
 * このサイトは main への push がそのまま GitHub Pages で公開される（レビュー無し・即時）。
 * 壊れた状態を push すると、気づくまでそのまま世に出続ける。
 * 実際に2026-10-24の点検で、次の事故が起きうる／起きていたことが分かった。
 *
 *   1. generate-foods.mjs は docs/foods/ の .html を全削除してから書き直すため、
 *      単体実行するとリダイレクトスタブ44件が消えてインデックス済みURLが404になる
 *   2. アプリ側リポジトリへの相対パスが切れていて、2026-09から生成が一度も成功していなかった
 *      （例外で落ちるだけなので誰も気づかない）
 *   3. LPの手書きの食品数が実データとずれたまま公開されていた（過去2回）
 *
 * 実行: node tools/verify.mjs   （問題があれば終了コード1）
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REDIRECTS, CATEGORY_REDIRECTS, EXPECTED_STUB_COUNT } from './redirect-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const FOODS = path.join(DOCS, 'foods');
const APP_REPO = path.resolve(ROOT, '../Protein_Note/protein-note');

const GA4_ID = 'G-SD50LR5JYC';

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const ok = (m) => notes.push(m);

/* 1. 削除してはいけないファイル（サイト側 CLAUDE.md の絶対ルール） */
const MUST_EXIST = [
  ['docs/CNAME', 'カスタムドメインの設定。消すと独自ドメインが外れる'],
  ['docs/.nojekyll', '消すとGitHub PagesがJekyll処理を始めて _ 始まりのファイルが落ちる'],
  ['docs/2cf87dde98d34a11997337121a87b4ec.txt', 'IndexNow のキー認証ファイル'],
  ['docs/robots.txt', 'クロール許可とsitemapの参照'],
  ['docs/sitemap.xml', '手書きサイトマップ'],
  ['docs/sitemap-foods.xml', '食品ページのサイトマップ'],
];
for (const [rel, why] of MUST_EXIST) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail(`必須ファイルが無い: ${rel}（${why}）`);
}
const legacyStubs = fs.existsSync(path.join(DOCS, 'protein-note-support'))
  ? fs.readdirSync(path.join(DOCS, 'protein-note-support')).filter((f) => f.endsWith('.html')).length
  : 0;
if (legacyStubs === 0) {
  fail('docs/protein-note-support/ の旧URLリダイレクトスタブが消えている（一度復元した経緯あり）');
} else {
  ok(`旧URLリダイレクトスタブ ${legacyStubs}件`);
}

/* 2. アプリ側リポジトリが読めるか（パス切れの早期検知） */
const APP_DB = path.join(APP_REPO, 'src/data/foodDatabase.ts');
let appFoodCount = null;
if (!fs.existsSync(APP_DB)) {
  fail(
    `アプリ側の食品DBが見つからない: ${APP_DB}\n` +
      '    → 2つのリポジトリは ~/dev/ に兄弟として並べること。片方を動かすとこの相対参照が切れる',
  );
} else {
  const raw = fs.readFileSync(APP_DB, 'utf8');
  appFoodCount = new Set([...raw.matchAll(/name:\s*["']([^"']+)["']/g)].map((m) => m[1])).size;
  ok(`アプリ側の食品DBを読めた（ユニーク食品名 ${appFoodCount}件）`);
}

/* 3. docs/foods/ の中身を分類する */
if (!fs.existsSync(FOODS)) {
  fail('docs/foods/ が存在しない');
} else {
  const files = fs.readdirSync(FOODS).filter((f) => f.endsWith('.html'));
  const content = [];
  const stubs = [];
  for (const f of files) {
    const s = fs.readFileSync(path.join(FOODS, f), 'utf8');
    (s.includes('http-equiv="refresh"') ? stubs : content).push([f, s]);
  }

  /* 3-a. 2段階生成が完了しているか（最大の事故パターン） */
  if (stubs.length !== EXPECTED_STUB_COUNT) {
    fail(
      `リダイレクトスタブが ${stubs.length}件（期待 ${EXPECTED_STUB_COUNT}件）\n` +
        '    → generate-foods.mjs の後に generate-food-redirects.mjs を実行していない可能性。\n' +
        '       この状態で push するとインデックス済みの旧URLが404になる。`npm run build` を使うこと',
    );
  } else {
    ok(`リダイレクトスタブ ${stubs.length}件（2段階生成が完了している）`);
  }

  /* 3-b. スタブの移動先が実在するか（リンク切れ防止） */
  const broken = [];
  for (const [from, to] of Object.entries({ ...REDIRECTS, ...CATEGORY_REDIRECTS })) {
    if (!fs.existsSync(path.join(FOODS, `${to}.html`))) broken.push(`${from} → ${to}`);
  }
  if (broken.length) fail(`リダイレクト先が存在しない: ${broken.join(' / ')}`);

  /* 3-c. コンテンツページの計測・インデックス可否 */
  const noGa4 = content.filter(([, s]) => !s.includes(GA4_ID)).map(([f]) => f);
  if (noGa4.length) {
    fail(`GA4タグが無いコンテンツページ ${noGa4.length}件: ${noGa4.slice(0, 5).join(', ')}`);
  } else {
    ok(`コンテンツページ ${content.length}件すべてにGA4タグあり`);
  }

  const noindexed = content.filter(([, s]) => /name="robots"[^>]*noindex/.test(s)).map(([f]) => f);
  if (noindexed.length) {
    fail(`コンテンツページに noindex が付いている ${noindexed.length}件: ${noindexed.slice(0, 5).join(', ')}`);
  }

  /* 3-c-2. スタブに noindex を付けてはならない（canonical と矛盾する）
   * canonical は「移動先を登録せよ」、noindex は「登録するな」。同時に出すと
   * Googleが noindex を canonical の移動先に適用し、本物のページまで落とす危険がある。
   * 2026-10-27 に全50件（食品44＋旧パス6）から削除した。再発させないこと。 */
  const stubNoindex = stubs.filter(([, s]) => /name="robots"[^>]*noindex/.test(s)).map(([f]) => f);
  if (stubNoindex.length) {
    fail(
      `リダイレクトスタブに noindex が付いている ${stubNoindex.length}件: ${stubNoindex.slice(0, 5).join(', ')}\n` +
        '    → canonical と矛盾し、移動先の本物のページまで検索結果から落ちる危険がある',
    );
  }

  const noCanonical = content.filter(([, s]) => !/rel="canonical"/.test(s)).map(([f]) => f);
  if (noCanonical.length) {
    fail(`canonical が無いコンテンツページ ${noCanonical.length}件: ${noCanonical.slice(0, 5).join(', ')}`);
  }

  /* 3-d. スタブはサイトマップに載せない（noindexなので載せると矛盾する） */
  const sitemapPath = path.join(DOCS, 'sitemap-foods.xml');
  if (fs.existsSync(sitemapPath)) {
    const sitemap = fs.readFileSync(sitemapPath, 'utf8');
    // 部分一致で判定しないこと。`昆布.html` は `昆布だし昆布.html` の、
    // `チョコレート.html` は `ホワイトチョコレート.html` の末尾に含まれるため、
    // includes(encodeURI(f)) だと実在しない掲載を誤検出する。<loc> ごと完全一致させる。
    const SITE = 'https://protein-note.theslopebook.jp';
    const listed = stubs
      .filter(([f]) => sitemap.includes(`<loc>${SITE}/foods/${encodeURI(f)}</loc>`))
      .map(([f]) => f);
    if (listed.length) {
      fail(`noindexのリダイレクトスタブがサイトマップに載っている ${listed.length}件: ${listed.slice(0, 3).join(', ')}`);
    }
    const urlCount = (sitemap.match(/<loc>/g) || []).length;
    ok(`sitemap-foods.xml: ${urlCount} URL / コンテンツページ ${content.length}件`);
  }
}

/* 3-e. サイト全体: noindex と「別URLを指す canonical」の同時指定を禁止する
 * docs/foods/ 以外（docs/protein-note-support/ の旧パススタブなど）も対象にする。
 * 旧パススタブの canonical は現在インデックスされている7ページを指しているため、
 * ここに noindex があると唯一インデックスされているページを落としかねない。 */
{
  const walk = (d, acc = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, acc);
      else if (e.name.endsWith('.html')) acc.push(p);
    }
    return acc;
  };
  const conflicts = [];
  for (const p of walk(DOCS)) {
    const s = fs.readFileSync(p, 'utf8');
    if (!/name="robots"[^>]*noindex/.test(s)) continue;
    const m = /rel="canonical" href="([^"]+)"/.exec(s);
    if (m) conflicts.push(`${path.relative(ROOT, p)} → ${m[1]}`);
  }
  if (conflicts.length) {
    fail(
      `noindex と canonical を同時に持つページ ${conflicts.length}件\n` +
        '    → 矛盾したシグナル。Googleが noindex を canonical の移動先に適用し、\n' +
        '       移動先の本物のページまで検索結果から落ちる危険がある（2026-10-27に全50件を解消）\n' +
        conflicts.slice(0, 3).map((c) => `       ${c}`).join('\n'),
    );
  } else {
    ok('noindex と canonical の同時指定なし（サイト全体）');
  }
}

/* 4. LPの手書き数値が実データと一致しているか（景表法。過去2回ずれた） */
const lp = path.join(DOCS, 'index.html');
if (fs.existsSync(lp) && appFoodCount !== null) {
  const html = fs.readFileSync(lp, 'utf8');
  const m = /data-count="(\d+)"[^>]*>[^<]*<\/span>\s*<span class="stat-label">食品データベース/.exec(html);
  if (!m) {
    fail('LPの食品数の記載を見つけられない（docs/index.html のHTML構造が変わった可能性）');
  } else if (Number(m[1]) !== appFoodCount) {
    fail(`LPの食品数が実データとずれている: 表示 ${m[1]} / 実際 ${appFoodCount}（docs/index.html）`);
  } else {
    ok(`LPの食品数 ${m[1]} がアプリの実データと一致`);
  }
}

/* 出力 */
for (const n of notes) console.log('  ✅', n);
if (problems.length) {
  console.log('\n❌ 公開前に直すべき問題が', problems.length, '件あります\n');
  problems.forEach((p) => console.log('  -', p));
  process.exit(1);
}
console.log('\n✅ すべての不変条件を満たしています（公開して問題ありません）');
