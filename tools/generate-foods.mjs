#!/usr/bin/env node
/**
 * 食品データベースの静的ページ生成
 *
 * アプリ側の src/data/foodDatabase.ts（696食品）を読み取り、docs/foods/ 配下に
 * 個別ページ・カテゴリページ・ランキング・一覧を生成する。
 *
 * ■ アプリ側リポジトリは読み取りのみ（CLAUDE.md の絶対ルール）
 *   このスクリプトは APP_DB_PATH を fs.readFileSync で読むだけで、一切書き込まない。
 *
 * ■ 法令順守（景表法・薬機法）
 *   - 数値と出典のみを提示し、効能効果（痩せる・免疫・疲労回復・基礎代謝アップ等）は一切書かない
 *   - タグ（「高タンパク」等）は出力しない。栄養強調表示の基準（健康増進法）に抵触しうるため、
 *     事実である「数値」だけを載せる方針にしている
 *   - 全ページに出典と免責を、主張と同じ視認性で本文直下に置く
 *
 * 実行:
 *   node tools/generate-foods.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT_DIR = path.join(DOCS, 'foods');

/** アプリ側リポジトリ（読み取り専用） */
const APP_REPO = path.resolve(ROOT, '../Protein_Note/protein-note');
const APP_DB_PATH = path.join(APP_REPO, 'src/data/foodDatabase.ts');
/** 自社算出の材料内訳（成分表に収載がない料理のレシピ定義） */
const APP_RECIPES_PATH = path.join(APP_REPO, 'scripts/food-data/recipes.json');
/** 材料の食品番号から成分表の名前と栄養値を引くための元データ */
const APP_SEIBUNHYO_PATH = path.join(APP_REPO, 'scripts/food-data/seibunhyo_8th_2023.json');

const SITE = 'https://protein-note.theslopebook.jp';
const GA_ID = 'G-SD50LR5JYC';
const APP_STORE_URL = 'https://apps.apple.com/jp/app/id6748221439';

/**
 * 出典（2026-08-01 にアプリ側の食品DBを全面刷新して確定）
 *
 * 以前のアプリDBは版が記録されておらず、文部科学省の食品成分データベース
 * （https://fooddb.mext.go.jp/）と実測比較して【七訂】と判定していた。
 *   水稲めし 精白米  八訂増補2023年 156kcal / 旧アプリDB 168kcal（＝七訂）
 *   角形食パン       八訂増補2023年 248kcal / 旧アプリDB 264kcal（＝七訂）
 *
 * その後アプリ側を八訂増補2023年へ全面差し替えし、各食品に食品番号（seibunhyoNo）を
 * 持たせて公式値と機械的に照合できるようにした。現在は全件が最新版の収載値と一致する
 * （照合: protein-note 側の scripts/food-data/verify.mjs、不一致0件）。
 *
 * 政府標準利用規約（第2.0版）により出典明示のうえ商用利用が認められている。
 * https://www.mext.go.jp/a_menu/syokuhinseibun/
 */
const FOOD_DATA_SOURCE =
  '文部科学省『日本食品標準成分表（八訂）増補2023年』';

/**
 * 出典の種類（アプリの source 文字列 → ページに書く表記）
 *
 * ★ 以前は成分表由来の611件だけを公開し、残り43件を落としていた。
 *   アプリには654件あるのにサイトには611件しかない状態で、
 *   アプリで見た食品をサイトで探すと見つからないという食い違いが起きていた。
 *
 *   落としていた理由は「全件を『出典: 日本食品標準成分表』として公開すると
 *   虚偽表示になる」というものだったが、正しい解決は非公開にすることではなく
 *   【ページごとに実際の出典を書く】こと。3種類を出し分けて全件公開する。
 *
 *     日本食品標準成分表（八訂）増補2023年  611  収載値そのもの。食品番号を併記
 *     自社算出（成分表に基づく）            24  材料と分量の内訳表を併載して検証可能にする
 *     市販品の栄養成分表示に基づく参考値      19  成分表に収載され得ないもの。製品差を明記
 *
 *   自社算出の内訳は recipes.json（アプリ側リポジトリ）から読む。
 *   材料に食品番号が付いているので、読み手が成分表で1つずつ検算できる。
 *   これは他サイトには無い独自の情報でもある。
 */
const SOURCE_OFFICIAL = '日本食品標準成分表（八訂）増補2023年';

/** アプリの source からページ用の出典文を作る */
function sourceTextFor(item) {
  const src = String(item.source || '');
  if (item.seibunhyoNo && src === SOURCE_OFFICIAL) {
    return `栄養成分値は${esc(FOOD_DATA_SOURCE)}の収載値です（食品番号 ${esc(item.seibunhyoNo)}）。同成分表は政府標準利用規約（第2.0版）に基づき、出典を明示したうえで利用しています。`;
  }
  if (src.startsWith('自社算出')) {
    return `この料理は${esc(FOOD_DATA_SOURCE)}に収載がないため、同成分表に収載されている材料の値から当サイトが計算した参考値です。計算に使った材料と分量は下の表のとおりで、各材料の食品番号から成分表の値を確認できます。レシピは標準的な構成の推定であり、店舗や家庭によって変動します。`;
  }
  if (src.startsWith('市販')) {
    return `この食品は原料の性質上${esc(FOOD_DATA_SOURCE)}に収載がありません。国内で広く流通している製品の栄養成分表示（食品表示法により表示が義務づけられた公開情報）に基づく参考値です。製品ごとに配合が異なるため、実際にお使いの製品の表示をご確認ください。`;
  }
  return `栄養成分値は${esc(FOOD_DATA_SOURCE)}を基にした参考値です。`;
}

/** 出典の短い分類名（一覧・description 用） */
function sourceKindFor(item) {
  const src = String(item.source || '');
  if (src.startsWith('自社算出')) return '当サイトによる算出値';
  if (src.startsWith('市販')) return '市販品の栄養成分表示に基づく参考値';
  return FOOD_DATA_SOURCE;
}

/** 全ページ共通の免責（主張の直下に、本文と同じ大きさで置く） */
const DISCLAIMER =
  '掲載している数値は目安です。品種・産地・部位・調理方法・製品によって変動します。特定の健康効果や結果を示すもの、保証するものではありません。';

const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// アプリ側 foodDatabase.ts の読み取り
// ---------------------------------------------------------------------------

/**
 * TypeScript のオブジェクトリテラルを波括弧の対応で切り出して評価する。
 * 行番号をハードコードするとアプリ側の編集で壊れるため、構文的に切り出す。
 */
function loadFoodDatabase() {
  const raw = fs.readFileSync(APP_DB_PATH, 'utf8');
  const marker = 'export const foodDatabase';
  const declStart = raw.indexOf(marker);
  if (declStart === -1) throw new Error('foodDatabase の宣言が見つかりません');

  const braceStart = raw.indexOf('{', declStart);
  if (braceStart === -1) throw new Error('foodDatabase の開き括弧が見つかりません');

  let depth = 0;
  let inString = null;
  let braceEnd = -1;
  for (let i = braceStart; i < raw.length; i++) {
    const ch = raw[i];
    const prev = raw[i - 1];
    if (inString) {
      if (ch === inString && prev !== '\\') inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }
  if (braceEnd === -1) throw new Error('foodDatabase の閉じ括弧が見つかりません');

  const literal = raw.slice(braceStart, braceEnd + 1);
  // 型注釈を含まない純粋なオブジェクトリテラルなのでそのまま評価できる
  return new Function(`return (${literal});`)();
}

/** 自社算出の材料内訳。キーは食品名。_readme 等のメタキーは除く */
const RECIPES = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(APP_RECIPES_PATH, 'utf8'));
    return Object.fromEntries(Object.entries(j).filter(([k]) => !k.startsWith('_')));
  } catch {
    // レシピ定義が読めなくても内訳表が出ないだけで、ページ生成は続行できる
    return {};
  }
})();

/** 食品番号 → 成分表の収載名と栄養値 */
const SEIBUNHYO = (() => {
  try {
    return new Map(JSON.parse(fs.readFileSync(APP_SEIBUNHYO_PATH, 'utf8')).map((f) => [f.no, f]));
  } catch {
    return new Map();
  }
})();


/**
 * LP に手書きしてある数値が、実データとずれていないか検査する
 *
 * docs/index.html の統計バーは食品数・種目数を直接書いており、
 * データを更新しても自動では追随しない。実際に食品DBを 695→654 に減らしたあとも
 * 「695 食品データベース」と表示し続けていた（2回目の同種事故）。
 *
 * 事実と違う数値を製品の訴求として出すのは景表法上の問題になりうるので、
 * 生成のたびに機械的に検出する。直すのは人だが、気づけないことを無くす。
 */
function checkHardcodedStats(foodCount) {
  const problems = [];
  const lp = path.join(DOCS, 'index.html');
  if (!fs.existsSync(lp)) return problems;
  const html = fs.readFileSync(lp, 'utf8');

  // 食品数
  const m = /data-count="(\d+)"[^>]*>[^<]*<\/span>\s*<span class="stat-label">食品データベース/.exec(html);
  if (!m) problems.push('LPの食品数の記載を見つけられませんでした（HTMLの構造が変わった可能性）');
  else if (Number(m[1]) !== foodCount) {
    problems.push(`LPの食品数が実データとずれています: 表示 ${m[1]} / 実際 ${foodCount}（docs/index.html）`);
  }

  // 種目数（アプリ側の exerciseDatabase.ts を数える）
  try {
    const ex = fs.readFileSync(path.join(APP_REPO, 'src/data/exerciseDatabase.ts'), 'utf8');
    const exCount = (ex.match(/^\s+name:/gm) || []).length;
    const e = /data-count="(\d+)"([^>]*)>[^<]*<\/span>\s*<span class="stat-label">筋トレ種目/.exec(html);
    if (e) {
      if (Number(e[1]) !== exCount) {
        problems.push(`LPの筋トレ種目数がずれています: 表示 ${e[1]} / 実際 ${exCount}`);
      }
      // 「60+」のような上振れ表記は、実数ちょうどのときは事実と違う
      if (/data-suffix="\+"/.test(e[2]) && Number(e[1]) >= exCount) {
        problems.push(`LPが「${e[1]}+」と表示していますが実数は ${exCount} です（「+」は事実と違う）`);
      }
    }
  } catch {
    // 種目DBが読めないときは黙って飛ばす（食品ページ生成の妨げにしない）
  }
  return problems;
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ファイル名・URLに使える形へ整える（日本語はそのまま残す＝日本語検索での視認性が高い） */
function slugify(name) {
  return name
    .replace(/[（）()[\]{}<>「」『』]/g, '')
    .replace(/[\/\\?#&%＋+，,。・:;：；!！"'’”\s　]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function fmt(v, unit) {
  const n = num(v);
  return n === null ? '—' : `${Math.round(n * 10) / 10}${unit}`;
}

// ---------------------------------------------------------------------------
// 共通レイアウト
// ---------------------------------------------------------------------------

function layout({ title, description, canonicalPath, breadcrumb, body, depth = 1 }) {
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
          <a href="${up}tools/protein-calculator.html">必要量の計算</a>
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
          <a href="${up}">ホーム</a>
          <a href="${up}foods/">食品成分表</a>
          <a href="${up}tools/protein-calculator.html">必要量の計算</a>
          <a href="${up}guide/">使い方ガイド</a>
          <a href="${up}faq.html">よくある質問</a>
          <a href="${up}terms.html">利用規約</a>
          <a href="${up}privacy.html">プライバシーポリシー</a>
        </nav>
        <p class="copyright">本サイトはアクセス状況の把握のため Google Analytics を使用しています。</p>
        <p class="copyright">&copy; 2025-2026 Protein Note. All rights reserved.</p>
      </div>
    </footer>
    <script>
      document.querySelectorAll('[data-cta]').forEach(function (a) {
        a.addEventListener('click', function () {
          if (typeof gtag === 'function') {
            gtag('event', 'cta_click', { cta_location: a.getAttribute('data-cta') });
          }
        });
      });
    </script>
  </body>
</html>
`;
}

/**
 * 出典と免責。個別食品ページでは食品番号まで書けるので item を渡す。
 * 番号を載せるのは、読み手が文部科学省の食品成分データベースで同じ値を引けるようにするため。
 */
function sourceBlock(item) {
  const text = item
    ? sourceTextFor(item)
    : `栄養成分値は${esc(FOOD_DATA_SOURCE)}の収載値です。同成分表は政府標準利用規約（第2.0版）に基づき、出典を明示したうえで利用しています。一部の料理・製品は成分表に収載がないため、材料からの算出値または市販品の栄養成分表示に基づく参考値を掲載しています（各食品のページに明記）。`;
  return `      <section class="food-source">
        <h2>出典と注意事項</h2>
        <p>${text}</p>
        <p class="food-disclaimer">${esc(DISCLAIMER)}</p>
        <p class="food-disclaimer">本ページは栄養成分の情報提供を目的としたもので、医療上の助言ではありません。治療中の方や食事制限のある方は医師・管理栄養士にご相談ください。</p>
      </section>`;
}

function ctaBlock(location) {
  return `      <div class="mid-cta">
        <p>調べた食品は、プロテインノートで記録できます。基本機能は無料です。</p>
        <a href="${APP_STORE_URL}" class="store-badge" target="_blank" rel="noopener noreferrer" data-cta="${esc(location)}">
          <img src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/ja-jp?size=250x83" alt="App Storeからダウンロード" width="157" height="54" loading="lazy" />
        </a>
      </div>`;
}

// ---------------------------------------------------------------------------
// ページ生成
// ---------------------------------------------------------------------------

function nutritionTable(item, grams) {
  const ratio = grams / 100;
  const row = (label, v, unit) => {
    const n = num(v);
    return `          <tr><th>${label}</th><td>${n === null ? '—' : `${Math.round(n * ratio * 10) / 10}${unit}`}</td></tr>`;
  };
  return `      <table class="food-table">
        <tbody>
${row('タンパク質', item.proteinPer100g, 'g')}
${row('カロリー', item.caloriesPer100g, 'kcal')}
${row('脂質', item.fatPer100g, 'g')}
${row('炭水化物', item.carbsPer100g, 'g')}
        </tbody>
      </table>`;
}

/**
 * 自社算出の食品に、計算に使った材料の内訳を出す。
 *
 * 数値だけ出して「算出値です」と書くのは、読み手にとって検証しようがない。
 * 材料・分量・食品番号まで出せば、成分表を引いて1つずつ検算できる。
 * 出典の誠実さの問題であると同時に、他サイトには無い独自の情報でもある。
 */
function breakdownSection(item) {
  const recipe = RECIPES[item.name];
  if (!recipe || !Array.isArray(recipe.ingredients)) return '';

  const rows = recipe.ingredients
    .map((ing) => {
      const f = SEIBUNHYO.get(ing.no);
      const g = num(ing.g);
      const kcal = f && g !== null ? Math.round((f.kcal * g) / 100) : null;
      const prot = f && g !== null ? Math.round((f.protein * g) / 100 * 10) / 10 : null;
      return `          <tr>
            <td>${esc(f ? f.name : ing.name || '—')}</td>
            <td>${esc(ing.no)}</td>
            <td>${g === null ? '—' : `${g}g`}</td>
            <td>${prot === null ? '—' : `${prot}g`}</td>
            <td>${kcal === null ? '—' : `${kcal}kcal`}</td>
          </tr>`;
    })
    .join('\n');

  const totalG = recipe.ingredients.reduce((n, i) => n + (num(i.g) ?? 0), 0);

  return `      <h2>この数値の内訳</h2>
      <p>${esc(item.name)}は日本食品標準成分表に収載がないため、成分表に収載されている次の材料の値から計算しています${recipe.note ? `（${esc(recipe.note)}）` : ''}。食品番号から成分表の値を確認できます。</p>
      <div class="food-table-wrap">
      <table class="food-table">
        <thead>
          <tr><th>材料（成分表の収載名）</th><th>食品番号</th><th>分量</th><th>タンパク質</th><th>カロリー</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
        <tfoot>
          <tr><th>合計</th><td>—</td><td>${totalG}g</td><td>—</td><td>—</td></tr>
        </tfoot>
      </table>
      </div>
      <p class="food-disclaimer">100gあたりの値は、上の合計を総重量で割って換算したものです。レシピは標準的な構成の推定であり、店舗・家庭によって変動します。</p>`;
}

function pfcBalance(item) {
  const p = num(item.proteinPer100g) ?? 0;
  const f = num(item.fatPer100g) ?? 0;
  const c = num(item.carbsPer100g) ?? 0;
  const pk = p * 4;
  const fk = f * 9;
  const ck = c * 4;
  const total = pk + fk + ck;
  if (total <= 0) return '';
  const pct = (v) => Math.round((v / total) * 100);
  return `      <h2>PFCバランス</h2>
      <p>タンパク質・脂質・炭水化物をそれぞれ 4kcal/g・9kcal/g・4kcal/g として換算した、エネルギー比の目安です。</p>
      <table class="food-table">
        <tbody>
          <tr><th>タンパク質</th><td>${pct(pk)}%</td></tr>
          <tr><th>脂質</th><td>${pct(fk)}%</td></tr>
          <tr><th>炭水化物</th><td>${pct(ck)}%</td></tr>
        </tbody>
      </table>
      <p class="food-disclaimer">この比率は各栄養素から換算した値のため、記載のカロリーとは一致しない場合があります。</p>`;
}

function foodPage(item, ctx) {
  const { categoryName, categorySlug, rank, categoryCount, related } = ctx;
  const slug = item.__slug;
  const serving = num(item.typicalServingG);
  const p = num(item.proteinPer100g);
  const cal = num(item.caloriesPer100g);

  const title = `${item.name}のタンパク質量・カロリー｜100gあたりの栄養成分 - プロテインノート`;
  const description = `${item.name}の栄養成分。100gあたりタンパク質${fmt(p, 'g')}・カロリー${fmt(cal, 'kcal')}・脂質${fmt(item.fatPer100g, 'g')}・炭水化物${fmt(item.carbsPer100g, 'g')}。${serving && serving !== 100 ? `1食分の目安${serving}gあたりの数値も掲載。` : ''}出典は${FOOD_DATA_SOURCE}。`;

  // typicalServingG が 100 の食品は「100gあたり」と同一の表になり、
  // 重複コンテンツにしかならないので出力しない
  const servingSection =
    serving && serving !== 100
      ? `      <h2>1食分の目安（${serving}g）あたり</h2>
${nutritionTable(item, serving)}`
      : '';

  const relatedSection = related.length
    ? `      <h2>${esc(categoryName)}の近い食品</h2>
      <ul class="food-links">
${related
  .map(
    (r) =>
      `        <li><a href="${encodeURI(r.__slug)}.html">${esc(r.name)}</a> <span class="food-links-note">タンパク質 ${fmt(r.proteinPer100g, 'g')}／100g</span></li>`,
  )
  .join('\n')}
      </ul>`
    : '';

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">食品成分表</a> › <a href="category-${encodeURI(categorySlug)}.html">${esc(categoryName)}</a> › <span>${esc(item.name)}</span></nav>
      <h1>${esc(item.name)}の栄養成分</h1>

      <p class="support-lead">
        ${esc(item.name)}（${esc(categoryName)}）100gあたりの、タンパク質・カロリー・脂質・炭水化物です。
      </p>

      <h2>100gあたり</h2>
${nutritionTable(item, 100)}

${servingSection}

${pfcBalance(item)}

${breakdownSection(item)}

      <h2>${esc(categoryName)}のなかでの位置</h2>
      <p>${esc(categoryName)}に収録している${categoryCount}品目のうち、タンパク質量は<strong>${rank}番目</strong>です。</p>

${relatedSection}

${sourceBlock(item)}

${ctaBlock('foods_detail')}

      <nav class="guide-nav"><a href="./">← 食品成分表の一覧</a><a href="../tools/protein-calculator.html">必要量を計算する →</a></nav>`;

  return layout({
    title,
    description,
    canonicalPath: `/foods/${encodeURI(slug)}.html`,
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '食品成分表', path: '/foods/' },
      { name: categoryName, path: `/foods/category-${encodeURI(categorySlug)}.html` },
      { name: item.name, path: `/foods/${encodeURI(slug)}.html` },
    ],
    body,
  });
}

function foodTableRows(items) {
  return items
    .map(
      (it) =>
        `          <tr><td><a href="${encodeURI(it.__slug)}.html">${esc(it.name)}</a></td><td>${fmt(it.proteinPer100g, 'g')}</td><td>${fmt(it.caloriesPer100g, 'kcal')}</td><td>${fmt(it.fatPer100g, 'g')}</td><td>${fmt(it.carbsPer100g, 'g')}</td></tr>`,
    )
    .join('\n');
}

function categoryPage(categoryName, categorySlug, items) {
  const sorted = [...items].sort(
    (a, b) => (num(b.proteinPer100g) ?? -1) - (num(a.proteinPer100g) ?? -1),
  );
  const title = `${categoryName}のタンパク質・カロリー一覧（${items.length}品目）- プロテインノート`;
  const description = `${categoryName}${items.length}品目の100gあたりタンパク質・カロリー・脂質・炭水化物の一覧。タンパク質量の多い順に掲載。出典は${FOOD_DATA_SOURCE}。`;

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">食品成分表</a> › <span>${esc(categoryName)}</span></nav>
      <h1>${esc(categoryName)}の栄養成分一覧</h1>
      <p class="support-lead">${esc(categoryName)}に収録している${items.length}品目を、100gあたりのタンパク質量が多い順に並べています。</p>

      <div class="table-wrap">
        <table class="food-table food-table--list">
          <thead><tr><th>食品</th><th>タンパク質</th><th>カロリー</th><th>脂質</th><th>炭水化物</th></tr></thead>
          <tbody>
${foodTableRows(sorted)}
          </tbody>
        </table>
      </div>

${sourceBlock()}

${ctaBlock('foods_category')}

      <nav class="guide-nav"><a href="./">← 食品成分表の一覧</a><a href="protein-ranking.html">タンパク質量の多い食品 →</a></nav>`;

  return layout({
    title,
    description,
    canonicalPath: `/foods/category-${encodeURI(categorySlug)}.html`,
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '食品成分表', path: '/foods/' },
      { name: categoryName, path: `/foods/category-${encodeURI(categorySlug)}.html` },
    ],
    body,
  });
}

function rankingPage(allItems) {
  const top = [...allItems]
    .filter((it) => num(it.proteinPer100g) !== null)
    .sort((a, b) => b.proteinPer100g - a.proteinPer100g)
    .slice(0, 100);

  const title = `タンパク質が多い食品ランキング100｜100gあたり - プロテインノート`;
  const description = `${allItems.length}品目から、100gあたりのタンパク質量が多い食品を100位まで掲載。カロリー・脂質・炭水化物も併記。出典は${FOOD_DATA_SOURCE}。`;

  const rows = top
    .map(
      (it, i) =>
        `          <tr><td>${i + 1}</td><td><a href="${encodeURI(it.__slug)}.html">${esc(it.name)}</a></td><td>${fmt(it.proteinPer100g, 'g')}</td><td>${fmt(it.caloriesPer100g, 'kcal')}</td><td>${esc(it.__categoryName)}</td></tr>`,
    )
    .join('\n');

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <a href="./">食品成分表</a> › <span>タンパク質が多い食品</span></nav>
      <h1>タンパク質が多い食品ランキング100</h1>
      <p class="support-lead">収録している${allItems.length}品目を、100gあたりのタンパク質量が多い順に100位まで並べています。</p>

      <div class="table-wrap">
        <table class="food-table food-table--list">
          <thead><tr><th>順位</th><th>食品</th><th>タンパク質</th><th>カロリー</th><th>分類</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>

      <p class="food-disclaimer">100gあたりで比較しているため、1食あたりで食べる量が少ない食品（調味料・乾物など）も上位に含まれます。実際の摂取量は各ページの「1食分の目安」もあわせてご確認ください。</p>

${sourceBlock()}

${ctaBlock('foods_ranking')}

      <nav class="guide-nav"><a href="./">← 食品成分表の一覧</a><a href="../tools/protein-calculator.html">必要量を計算する →</a></nav>`;

  return layout({
    title,
    description,
    canonicalPath: '/foods/protein-ranking.html',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '食品成分表', path: '/foods/' },
      { name: 'タンパク質が多い食品ランキング100', path: '/foods/protein-ranking.html' },
    ],
    body,
  });
}

function indexPage(categories, total) {
  const title = `食品のタンパク質・カロリー一覧（${total}品目）- プロテインノート`;
  const description = `${total}品目の100gあたりタンパク質・カロリー・脂質・炭水化物を分類別に掲載。出典は${FOOD_DATA_SOURCE}。`;

  const cards = categories
    .map(
      (c) =>
        `        <li><a href="category-${encodeURI(c.slug)}.html">${esc(c.name)}</a> <span class="food-links-note">${c.items.length}品目</span></li>`,
    )
    .join('\n');

  const body = `      <nav class="breadcrumb" aria-label="パンくず"><a href="../">ホーム</a> › <span>食品成分表</span></nav>
      <h1>食品のタンパク質・カロリー一覧</h1>
      <p class="support-lead">${total}品目の100gあたりの栄養成分（タンパク質・カロリー・脂質・炭水化物）を、分類別にまとめています。</p>

      <h2>タンパク質量から探す</h2>
      <ul class="food-links">
        <li><a href="protein-ranking.html">タンパク質が多い食品ランキング100</a></li>
      </ul>

      <h2>分類から探す</h2>
      <ul class="food-links food-links--grid">
${cards}
      </ul>

${sourceBlock()}

${ctaBlock('foods_index')}`;

  return layout({
    title,
    description,
    canonicalPath: '/foods/',
    breadcrumb: [
      { name: 'ホーム', path: '/' },
      { name: '食品成分表', path: '/foods/' },
    ],
    body,
  });
}

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

function main() {
  const db = loadFoodDatabase();

  // スラッグ重複を検出しつつ全食品を平坦化
  const seen = new Map();
  const categories = [];
  let total = 0;

  for (const [key, group] of Object.entries(db)) {
    if (!group || !Array.isArray(group.items)) continue;
    const categoryName = group.category || key;
    const categorySlug = slugify(categoryName) || key;
    const items = [];

    for (const item of group.items) {
      if (!item || !item.name) continue;
      // 全件公開する。出典は sourceTextFor() でページごとに書き分ける
      let slug = slugify(item.name);
      if (!slug) continue;
      if (seen.has(slug)) {
        const n = seen.get(slug) + 1;
        seen.set(slug, n);
        slug = `${slug}-${n}`;
      } else {
        seen.set(slug, 1);
      }
      item.__slug = slug;
      item.__categoryName = categoryName;
      item.__categorySlug = categorySlug;
      items.push(item);
      total++;
    }

    if (items.length) categories.push({ key, name: categoryName, slug: categorySlug, items });
  }

  // 出力先を毎回まっさらにする。
  // 対象食品が減ったときに前回生成分が孤児として残り続けると、
  // sitemapから消えたのに公開され続ける（＝古い出典表記のページが残る）事故になる。
  if (fs.existsSync(OUT_DIR)) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      if (f.endsWith('.html')) fs.unlinkSync(path.join(OUT_DIR, f));
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const urls = [];
  const addUrl = (loc, priority, changefreq) =>
    urls.push({ loc, priority, changefreq });

  // 個別ページ
  for (const cat of categories) {
    const byProtein = [...cat.items].sort(
      (a, b) => (num(b.proteinPer100g) ?? -1) - (num(a.proteinPer100g) ?? -1),
    );

    for (const item of cat.items) {
      const rank = byProtein.indexOf(item) + 1;
      const p = num(item.proteinPer100g) ?? 0;
      const related = cat.items
        .filter((o) => o !== item && num(o.proteinPer100g) !== null)
        .sort(
          (a, b) =>
            Math.abs(a.proteinPer100g - p) - Math.abs(b.proteinPer100g - p),
        )
        .slice(0, 5);

      const html = foodPage(item, {
        categoryName: cat.name,
        categorySlug: cat.slug,
        rank,
        categoryCount: cat.items.length,
        related,
      });
      fs.writeFileSync(path.join(OUT_DIR, `${item.__slug}.html`), html, 'utf8');
      addUrl(`${SITE}/foods/${encodeURI(item.__slug)}.html`, '0.5', 'yearly');
    }

    fs.writeFileSync(
      path.join(OUT_DIR, `category-${cat.slug}.html`),
      categoryPage(cat.name, cat.slug, cat.items),
      'utf8',
    );
    addUrl(`${SITE}/foods/category-${encodeURI(cat.slug)}.html`, '0.6', 'monthly');
  }

  const allItems = categories.flatMap((c) => c.items);
  fs.writeFileSync(path.join(OUT_DIR, 'protein-ranking.html'), rankingPage(allItems), 'utf8');
  addUrl(`${SITE}/foods/protein-ranking.html`, '0.7', 'monthly');

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexPage(categories, total), 'utf8');
  addUrl(`${SITE}/foods/`, '0.8', 'monthly');
  addUrl(`${SITE}/tools/protein-calculator.html`, '0.8', 'monthly');

  // sitemap（既存 sitemap.xml には触れず、追加分を別ファイルにして robots.txt から参照する）
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(DOCS, 'sitemap-foods.xml'), sitemap, 'utf8');

  console.log(`生成完了: 食品 ${total}件 / カテゴリ ${categories.length}件`);
  console.log(`出力先: ${OUT_DIR}`);
  console.log(`sitemap: ${path.join(DOCS, 'sitemap-foods.xml')} (${urls.length} URL)`);
  console.log(`出典表記: ${FOOD_DATA_SOURCE}`);
  console.log('公開対象: 全件（出典は食品ごとにページへ明記）');

  const stat = checkHardcodedStats(total);
  if (stat.length) {
    console.log('\n⚠ LPの手書き数値が実データとずれています');
    stat.forEach((p) => console.log('  ' + p));
    process.exitCode = 1;
  }
}

main();
