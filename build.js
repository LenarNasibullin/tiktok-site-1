// Собирает сайт: берёт текстовые файлы из папки content/ и делает из них HTML-страницы в папке public/.
// Запускается автоматически на Vercel при каждом обновлении репозитория. Ничего устанавливать не нужно.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'public');
const CONTENT = path.join(ROOT, 'content');
const STATIC = path.join(ROOT, 'static');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const DEFAULT_LANG = config.defaultLang;

// ---------- адрес сайта (нужен для canonical и sitemap) ----------
function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  if (config.siteUrl && !/SIZIN|EXAMPLE/i.test(config.siteUrl)) return config.siteUrl.replace(/\/+$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return '';
}
const SITE = siteUrl();

// ---------- тексты формы скачивания по языкам ----------
const STR = {
  tr: {
    placeholder: 'TikTok video bağlantısını buraya yapıştırın',
    aria: 'TikTok video bağlantısı',
    go: 'İndir',
    video: 'Videoyu indir',
    audio: 'Sesi indir',
    coverAlt: 'Video kapak görseli',
    searching: 'Video aranıyor, lütfen birkaç saniye bekleyin…',
    ready: 'Hazır! İndirmek için düğmeye basın.',
    errInvalid: 'Geçerli bir TikTok bağlantısı girin.',
    errNotFound: 'Video bulunamadı. Bağlantıyı kontrol edin; video gizli veya silinmiş olabilir.',
    errServer: 'Bir hata oluştu. Biraz sonra tekrar deneyin.',
  },
  en: {
    placeholder: 'Paste the TikTok video link here',
    aria: 'TikTok video link',
    go: 'Download',
    video: 'Download video',
    audio: 'Download audio',
    coverAlt: 'Video cover image',
    searching: 'Looking for the video, please wait a few seconds…',
    ready: 'Ready! Press a button to download.',
    errInvalid: 'Enter a valid TikTok link.',
    errNotFound: 'Video not found. Check the link; the video may be private or deleted.',
    errServer: 'Something went wrong. Please try again in a moment.',
  },
};

// ---------- вспомогательные функции ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s) =>
  s.toLowerCase().replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

// ---------- мини-Markdown ----------
function inline(s) {
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}

function markdown(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const startsBlock = (l) => /^(#{1,4}\s|[-*]\s|\d+\.\s|<|\{\{tool\}\})/.test(l.trim());
  while (i < lines.length) {
    const line = lines[i];
    const t = line.trim();
    if (!t) { i++; continue; }
    if (t === '{{tool}}') { out.push('{{tool}}'); i++; continue; }
    if (t.startsWith('<')) {
      const buf = [];
      while (i < lines.length && lines[i].trim()) buf.push(lines[i++]);
      out.push(buf.join('\n'));
      continue;
    }
    let m = t.match(/^(#{1,4})\s+(.*)$/);
    if (m) {
      const level = Math.max(2, m[1].length);
      out.push(`<h${level} id="${slugify(m[2])}">${inline(m[2])}</h${level}>`);
      i++; continue;
    }
    if (/^[-*]\s+/.test(t)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) items.push(`<li>${inline(lines[i++].trim().replace(/^[-*]\s+/, ''))}</li>`);
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(t)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) items.push(`<li>${inline(lines[i++].trim().replace(/^\d+\.\s+/, ''))}</li>`);
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    const buf = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) buf.push(lines[i++].trim());
    if (!buf.length) { buf.push(lines[i++].trim()); }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const meta = {};
  let body = raw;
  if (m) {
    body = m[2];
    m[1].split('\n').forEach((l) => {
      const k = l.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (k) meta[k[1]] = k[2].trim().replace(/^["']|["']$/g, '');
    });
  }
  return { meta, body };
}

// ---------- форма скачивания ----------
function toolHtml(lang) {
  const s = STR[lang] || STR[DEFAULT_LANG] || STR.en;
  return `<div class="tool">
  <form id="tool-form" novalidate data-err-invalid="${esc(s.errInvalid)}" data-err-notfound="${esc(s.errNotFound)}" data-err-server="${esc(s.errServer)}" data-searching="${esc(s.searching)}" data-ready="${esc(s.ready)}">
    <input type="url" id="tool-url" placeholder="${esc(s.placeholder)}" aria-label="${esc(s.aria)}" autocomplete="off" required>
    <button type="submit" id="tool-go">${esc(s.go)}</button>
  </form>
  <p id="tool-status" role="status" aria-live="polite"></p>
  <div id="tool-result">
    <img id="tool-cover" alt="${esc(s.coverAlt)}">
    <div class="info">
      <p class="author" id="tool-author"></p>
      <p class="title" id="tool-title"></p>
      <div class="actions">
        <a class="btn" id="tool-video" href="#">${esc(s.video)}</a>
        <a class="btn alt" id="tool-audio" href="#">${esc(s.audio)}</a>
      </div>
    </div>
  </div>
</div>`;
}

// ---------- загрузка страниц ----------
const pages = [];
for (const lang of fs.existsSync(CONTENT) ? fs.readdirSync(CONTENT) : []) {
  const langDir = path.join(CONTENT, lang);
  if (!fs.statSync(langDir).isDirectory()) continue;
  for (const file of walk(langDir).filter((f) => f.endsWith('.md'))) {
    const { meta, body } = parseFile(file);
    if (String(meta.draft).toLowerCase() === 'true') continue;
    let rel = path.relative(langDir, file).replace(/\\/g, '/').replace(/\.md$/, '');
    if (rel === 'blog/index') continue;
    const base = lang === DEFAULT_LANG ? '/' : `/${lang}/`;
    pages.push({
      lang, rel, meta,
      url: base + (rel === 'index' ? '' : rel + '/'),
      html: markdown(body),
      isArticle: rel.startsWith('blog/'),
    });
  }
}

// страницы-списки блога
const blogLangs = [...new Set(pages.filter((p) => p.isArticle).map((p) => p.lang))];
for (const lang of blogLangs) {
  const base = lang === DEFAULT_LANG ? '/' : `/${lang}/`;
  const list = pages.filter((p) => p.lang === lang && p.isArticle)
    .sort((a, b) => String(b.meta.date || '').localeCompare(String(a.meta.date || '')));
  const items = list.map((p) => `<li><a href="${p.url}">${esc(p.meta.h1 || p.meta.title)}</a>${p.meta.date ? ` <span class="date">${esc(p.meta.date)}</span>` : ''}<br><span class="muted">${esc(p.meta.description || '')}</span></li>`).join('\n');
  const blogMeta = (config.blog && config.blog[lang]) || { title: 'Blog', description: '' };
  pages.push({
    lang, rel: 'blog', isList: true,
    meta: { title: blogMeta.title, description: blogMeta.description, h1: blogMeta.title },
    url: base + 'blog/',
    html: `<ul class="posts">${items}</ul>`,
  });
}

// группы переводов (для hreflang): страницы с одинаковым key в разных языках
const groups = {};
pages.forEach((p) => { if (p.meta.key) (groups[p.meta.key] = groups[p.meta.key] || []).push(p); });

// ---------- шаблон страницы ----------
function layout(p) {
  const m = p.meta;
  const lang = p.lang;
  const home = lang === DEFAULT_LANG ? '/' : `/${lang}/`;
  const nav = ((config.nav || {})[lang] || []).map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join('');
  const footer = (config.footer || {})[lang] || '';
  const footerLinks = ((config.footerLinks || {})[lang] || []).map(([label, href]) => `<a href="${href}">${esc(label)}</a>`).join(' · ');
  const abs = (u) => (SITE ? SITE + u : u);

  let alternates = '';
  const group = m.key && groups[m.key];
  if (group && group.length > 1 && SITE) {
    alternates = group.map((g) => `<link rel="alternate" hreflang="${g.lang}" href="${abs(g.url)}">`).join('\n');
    const def = group.find((g) => g.lang === DEFAULT_LANG);
    if (def) alternates += `\n<link rel="alternate" hreflang="x-default" href="${abs(def.url)}">`;
  }

  const ld = p.isArticle
    ? `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        headline: m.h1 || m.title, description: m.description || '', datePublished: m.date || undefined, inLanguage: lang,
      })}</script>`
    : '';

  const hasTool = p.html.includes('{{tool}}');
  const body = p.html.replace('{{tool}}', toolHtml(lang));

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
<meta name="description" content="${esc(m.description || '')}">
${SITE ? `<link rel="canonical" href="${abs(p.url)}">` : ''}
${alternates}
<meta property="og:type" content="${p.isArticle ? 'article' : 'website'}">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description || '')}">
${SITE ? `<meta property="og:url" content="${abs(p.url)}">` : ''}
<meta property="og:site_name" content="${esc(config.name)}">
<link rel="stylesheet" href="/style.css">
${ld}
</head>
<body>
<header><div class="wrap bar"><a class="logo" href="${home}">${esc(config.name)}</a><nav>${nav}</nav></div></header>
<main class="wrap">
<h1>${esc(m.h1 || m.title)}</h1>
${m.lead ? `<p class="lead">${esc(m.lead)}</p>` : ''}
${p.isArticle && m.date ? `<p class="date">${esc(m.date)}</p>` : ''}
<div class="prose">
${body}
</div>
</main>
<footer><div class="wrap"><p>${esc(footer)}</p>${footerLinks ? `<p>${footerLinks}</p>` : ''}</div></footer>
${hasTool ? '<script src="/app.js" defer></script>' : ''}
</body>
</html>
`;
}

// ---------- запись файлов ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(STATIC)) fs.cpSync(STATIC, OUT, { recursive: true });

for (const p of pages) {
  const dir = path.join(OUT, p.url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), layout(p));
}

fs.writeFileSync(path.join(OUT, '404.html'), `<!DOCTYPE html><html lang="${DEFAULT_LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>404</title><link rel="stylesheet" href="/style.css"></head><body><main class="wrap"><h1>404</h1><p><a href="/">${esc(config.name)}</a></p></main></body></html>`);

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n${SITE ? `\nSitemap: ${SITE}/sitemap.xml\n` : ''}`);
if (SITE) {
  const urls = pages.map((p) => `  <url><loc>${SITE}${p.url}</loc><lastmod>${p.meta.date || today}</lastmod></url>`).join('\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}

console.log(`Готово: страниц ${pages.length}${SITE ? ', sitemap создан для ' + SITE : ', адрес сайта не задан (canonical и sitemap пропущены)'}`);
