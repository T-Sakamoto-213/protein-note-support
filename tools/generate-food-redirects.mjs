#!/usr/bin/env node
/**
 * 食品ページの改名にともなうリダイレクトを生成する
 *
 * ■ なぜ必要か
 * 2026-08-01 にアプリ側の食品DBを日本食品標準成分表（八訂）増補2023年へ全面刷新した際、
 * 収載名に合わせて食品名を変えたものがある（いちご→イチゴ、お茶→緑茶、バゲット→フランスパン）。
 * ページのURLは食品名から作っているため、旧URLがそのままだと404になる。
 * すでにサイトはインデックス済みで、旧URLに張られた被リンクや検索結果からの流入を失う。
 *
 * ■ 同じ食品のときだけリダイレクトする
 * 中身が違うページへ飛ばすのは、利用者にとっては期待外れであり、
 * 検索エンジンからはソフト404と判定されて評価も引き継がれない。
 * 「おでん（大根）」「ぼたんえび（刺身）」のように成分表に該当がなく収録をやめた食品は、
 * 無理に代替へ飛ばさず素直に404にする。
 *
 * ■ GitHub Pages には301が無い
 * 静的ホスティングなのでサーバー側リダイレクトを書けない。
 * canonical + meta refresh のスタブで代替する。
 * 遅延0のmeta refreshはリダイレクトとして扱われ、canonical が新URLへ評価を寄せる。
 *
 * ■ noindex を付けてはならない（2026-10-27に削除）
 * canonical は「このページと移動先を同一視し、移動先を登録せよ」、
 * noindex は「登録するな」であり、同時に出すと矛盾したシグナルになる。
 * Googleが noindex を canonical の移動先（＝本物のページ）に適用し、
 * 移動先まで検索結果から落ちる危険がある。
 * スタブ自体は遅延0で転送され canonical も向いているので、noindex 無しでも
 * 実質インデックスされない。付ける利得が無く、リスクだけが残る。
 *
 * 実行: node tools/generate-food-redirects.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REDIRECTS, CATEGORY_REDIRECTS } from './redirect-map.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs', 'foods');
const SITE = 'https://protein-note.theslopebook.jp';

function stub(fromName, toSlug) {
  const url = `${SITE}/foods/${encodeURIComponent(toSlug)}.html`;
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=${url}" />
    <link rel="canonical" href="${url}" />
    <title>${fromName}の栄養成分 | プロテインノート</title>
  </head>
  <body>
    <p>このページは移転しました。 <a href="${url}">新しいページへ移動する</a></p>
  </body>
</html>
`;
}

let written = 0;
const missing = [];
for (const [from, to] of Object.entries({ ...REDIRECTS, ...CATEGORY_REDIRECTS })) {
  const target = path.join(OUT_DIR, `${to}.html`);
  if (!fs.existsSync(target)) { missing.push(`${from} → ${to}（移動先が無い）`); continue; }
  fs.writeFileSync(path.join(OUT_DIR, `${from}.html`), stub(from, to), 'utf8');
  written++;
  console.log(`  ${from} → ${to}`);
}

console.log(`\nリダイレクト ${written}件を生成しました`);
if (missing.length) {
  console.log('\n⚠ 移動先が存在しないため生成しなかったもの:');
  missing.forEach((m) => console.log('  ' + m));
  process.exit(1);
}
