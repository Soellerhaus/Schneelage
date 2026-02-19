import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DOMAIN = 'https://schneelage.app';
const BASE_PATH = process.env.BASE_PATH || '/Schneelage';

// Read resorts data
const data = JSON.parse(readFileSync(join(__dirname, 'data', 'resorts.json'), 'utf8'));
const resorts = data.resorts;

// Ensure output dirs
function ensureDir(p) { mkdirSync(p, { recursive: true }); }

const pub = join(__dirname, 'public');
ensureDir(pub);
ensureDir(join(pub, 'css'));
ensureDir(join(pub, 'js'));

// Copy static assets
cpSync(join(__dirname, 'src', 'css', 'style.css'), join(pub, 'css', 'style.css'));
cpSync(join(__dirname, 'src', 'js', 'app.js'), join(pub, 'js', 'app.js'));

// --- TEMPLATES ---

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function head(title, description, canonical, extra = '') {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noarchive, noimageindex">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(description)}">
<link rel="canonical" href="${DOMAIN}${canonical}">
<link rel="stylesheet" href="${BASE_PATH}/css/style.css">
${extra}
</head>`;
}

function nav() {
  return `<header class="site-header">
<div class="container">
<a href="${BASE_PATH}/" class="site-title">Schneelage Alpen</a>
<nav class="site-nav">
<a href="${BASE_PATH}/oesterreich/">AT</a>
<a href="${BASE_PATH}/schweiz/">CH</a>
<a href="${BASE_PATH}/deutschland/">DE</a>
<a href="${BASE_PATH}/impressum/">Impressum</a>
</nav>
</div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
<div class="container">
<div class="footer-links">
<a href="${BASE_PATH}/oesterreich/">Österreich</a>
<a href="${BASE_PATH}/schweiz/">Schweiz</a>
<a href="${BASE_PATH}/deutschland/">Deutschland</a>
<a href="${BASE_PATH}/tirol/">Tirol</a>
<a href="${BASE_PATH}/vorarlberg/">Vorarlberg</a>
<a href="${BASE_PATH}/salzburg/">Salzburg</a>
<a href="${BASE_PATH}/bayern/">Bayern</a>
<a href="${BASE_PATH}/graubuenden/">Graubünden</a>
<a href="${BASE_PATH}/wallis/">Wallis</a>
<a href="${BASE_PATH}/impressum/">Impressum</a>
<a href="${BASE_PATH}/datenschutz/">Datenschutz</a>
</div>
<div class="footer-source">Daten: Open-Meteo, EAWS, SLF, OpenHolidays</div>
</div>
</footer>`;
}

function scripts() {
  return `<script>window.BASE_PATH="${BASE_PATH}";</script>\n<script src="${BASE_PATH}/js/app.js"></script>`;
}

function rankingTable() {
  return `<div class="ranking-wrap">
<table class="ranking protected">
<thead>
<tr>
<th class="num">#</th>
<th>Skigebiet</th>
<th class="num">Score</th>
<th class="num">Schnee</th>
<th class="num">Neu 3d</th>
<th>Trend</th>
<th>Lawine</th>
<th class="num col-ticket">Ticket</th>
<th class="col-country">Land</th>
</tr>
</thead>
<tbody id="ranking-body"></tbody>
</table>
</div>`;
}

// --- HOME PAGE ---
function buildHome() {
  const title = 'Schneelage Alpen \u2013 Schneeh\u00F6hen & Ski-Score Ranking';
  const desc = 'Aktuelle Schneelage in 15 Skigebieten der Alpen: Schneeh\u00F6hen, Neuschnee, Ski-Score Ranking, Lawinenwarnung und 7-Tage Prognose f\u00FCr \u00D6sterreich, Schweiz und Deutschland.';

  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Schneelage Alpen',
    url: DOMAIN,
    description: desc
  };

  const html = `${head(title, desc, '/')}
<body data-page="home">
${nav()}
<div id="crowd-bar" class="crowd-bar"></div>
<main class="container">
<h1>Schneelage Alpen</h1>
<div id="date-display" class="date-display"></div>
${rankingTable()}
</main>
${footer()}
<script type="application/ld+json">${JSON.stringify(schemaOrg)}</script>
<script id="page-resorts-data" type="application/json">${JSON.stringify(resorts)}</script>
${scripts()}
</body>
</html>`;

  writeFileSync(join(pub, 'index.html'), html, 'utf8');
  console.log('  / (home)');
}

// --- RESORT DETAIL PAGE ---
function buildResort(resort) {
  ensureDir(join(pub, resort.slug));

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Schneelage', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: resort.countryName, item: DOMAIN + '/' + resort.countrySlug + '/' },
      { '@type': 'ListItem', position: 3, name: resort.region, item: DOMAIN + '/' + resort.regionSlug + '/' },
      { '@type': 'ListItem', position: 4, name: resort.name }
    ]
  };

  const skiResortSchema = {
    '@context': 'https://schema.org',
    '@type': 'SkiResort',
    name: resort.name,
    url: DOMAIN + '/' + resort.slug + '/',
    geo: {
      '@type': 'GeoCoordinates',
      latitude: resort.lat,
      longitude: resort.lon
    },
    address: {
      '@type': 'PostalAddress',
      addressRegion: resort.region,
      addressCountry: resort.country
    }
  };

  const html = `${head(resort.seo.title, resort.seo.description, '/' + resort.slug + '/')}
<body data-page="resort">
${nav()}
<main class="container">
<div class="breadcrumb">
<a href="${BASE_PATH}/">Schneelage</a><span>&gt;</span>
<a href="${BASE_PATH}/${escHtml(resort.countrySlug)}/">${escHtml(resort.countryName)}</a><span>&gt;</span>
<a href="${BASE_PATH}/${escHtml(resort.regionSlug)}/">${escHtml(resort.region)}</a><span>&gt;</span>
${escHtml(resort.name)}
</div>
<h1>Schneelage ${escHtml(resort.name)}</h1>
<div id="date-display" class="date-display"></div>
<div id="detail-content"></div>
</main>
${footer()}
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
<script type="application/ld+json">${JSON.stringify(skiResortSchema)}</script>
<script id="page-resort-data" type="application/json">${JSON.stringify(resort)}</script>
<script id="all-resorts-data" type="application/json">${JSON.stringify(resorts)}</script>
${scripts()}
</body>
</html>`;

  writeFileSync(join(pub, resort.slug, 'index.html'), html, 'utf8');
  console.log(`  /${resort.slug}/`);
}

// --- REGION PAGE ---
function buildRegion(regionSlug, regionName, regionResorts, countryName, countrySlug) {
  ensureDir(join(pub, regionSlug));

  const title = `Schneelage ${regionName} \u2013 Schneeh\u00F6hen & Ski-Score`;
  const desc = `Aktuelle Schneelage ${regionName}: Schneeh\u00F6hen, Neuschnee und Ski-Score f\u00FCr ${regionResorts.length} Skigebiete in ${regionName}.`;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Schneelage', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: countryName, item: DOMAIN + '/' + countrySlug + '/' },
      { '@type': 'ListItem', position: 3, name: regionName }
    ]
  };

  const html = `${head(title, desc, '/' + regionSlug + '/')}
<body data-page="region">
${nav()}
<div id="crowd-bar" class="crowd-bar"></div>
<main class="container">
<div class="breadcrumb">
<a href="${BASE_PATH}/">Schneelage</a><span>&gt;</span>
<a href="${BASE_PATH}/${escHtml(countrySlug)}/">${escHtml(countryName)}</a><span>&gt;</span>
${escHtml(regionName)}
</div>
<h1>Schneelage ${escHtml(regionName)}</h1>
<div id="date-display" class="date-display"></div>
${rankingTable()}
</main>
${footer()}
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
<script id="page-resorts-data" type="application/json">${JSON.stringify(regionResorts)}</script>
${scripts()}
</body>
</html>`;

  writeFileSync(join(pub, regionSlug, 'index.html'), html, 'utf8');
  console.log(`  /${regionSlug}/ (region)`);
}

// --- COUNTRY PAGE ---
function buildCountry(countrySlug, countryName, countryResorts) {
  ensureDir(join(pub, countrySlug));

  const title = `Schneelage ${countryName} \u2013 Schneeh\u00F6hen & Ski-Score`;
  const desc = `Aktuelle Schneelage ${countryName}: Schneeh\u00F6hen, Neuschnee und Ski-Score f\u00FCr ${countryResorts.length} Skigebiete in ${countryName}.`;

  // Unique regions in this country
  const regionMap = {};
  countryResorts.forEach(r => { regionMap[r.regionSlug] = r.region; });

  let regionLinks = '<div class="region-list">';
  for (const [slug, name] of Object.entries(regionMap)) {
    regionLinks += `<a href="${BASE_PATH}/${escHtml(slug)}/">${escHtml(name)}</a>`;
  }
  regionLinks += '</div>';

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Schneelage', item: DOMAIN + '/' },
      { '@type': 'ListItem', position: 2, name: countryName }
    ]
  };

  const html = `${head(title, desc, '/' + countrySlug + '/')}
<body data-page="country">
${nav()}
<div id="crowd-bar" class="crowd-bar"></div>
<main class="container">
<div class="breadcrumb">
<a href="${BASE_PATH}/">Schneelage</a><span>&gt;</span>
${escHtml(countryName)}
</div>
<h1>Schneelage ${escHtml(countryName)}</h1>
<div id="date-display" class="date-display"></div>
${regionLinks}
${rankingTable()}
</main>
${footer()}
<script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>
<script id="page-resorts-data" type="application/json">${JSON.stringify(countryResorts)}</script>
${scripts()}
</body>
</html>`;

  writeFileSync(join(pub, countrySlug, 'index.html'), html, 'utf8');
  console.log(`  /${countrySlug}/ (country)`);
}

// --- IMPRESSUM ---
function buildImpressum() {
  ensureDir(join(pub, 'impressum'));

  const html = `${head('Impressum \u2013 Schneelage Alpen', 'Impressum und Kontaktdaten von Schneelage Alpen.', '/impressum/')}
<body data-page="legal">
${nav()}
<main class="container">
<div class="breadcrumb">
<a href="${BASE_PATH}/">Schneelage</a><span>&gt;</span> Impressum
</div>
<h1>Impressum</h1>
<div class="legal-content">
<h2>Angaben gem\u00E4\u00DF \u00A7 5 TMG / \u00A7 25 MedienG</h2>
<p>[HIER DEINE DATEN EINTRAGEN]</p>
<p>Name: [Vorname Nachname]<br>
Anschrift: [Stra\u00DFe, PLZ Ort]<br>
E-Mail: [email@example.com]</p>
<h2>Haftungsausschluss</h2>
<p>Die auf dieser Website dargestellten Schneeh\u00F6hen, Lawinenwarnungen und Wetterdaten werden automatisiert von Drittanbietern bezogen. Trotz sorgf\u00E4ltiger Pr\u00FCfung \u00FCbernehmen wir keine Gew\u00E4hr f\u00FCr Richtigkeit, Vollst\u00E4ndigkeit und Aktualit\u00E4t der Daten. Ski- und Bergsport erfolgt auf eigene Gefahr. Informieren Sie sich immer zus\u00E4tzlich bei den offiziellen Lawinenwarndiensten.</p>
<h2>Datenquellen</h2>
<p>Open-Meteo (Wetter- und Schneedaten), EAWS / Lawine.at (Lawinenwarnungen \u00D6sterreich/Deutschland), SLF / WSL (Lawinenwarnungen Schweiz), OpenHolidays (Ferienkalender).</p>
</div>
</main>
${footer()}
</body>
</html>`;

  writeFileSync(join(pub, 'impressum', 'index.html'), html, 'utf8');
  console.log('  /impressum/');
}

// --- DATENSCHUTZ ---
function buildDatenschutz() {
  ensureDir(join(pub, 'datenschutz'));

  const html = `${head('Datenschutz \u2013 Schneelage Alpen', 'Datenschutzerkl\u00E4rung von Schneelage Alpen.', '/datenschutz/')}
<body data-page="legal">
${nav()}
<main class="container">
<div class="breadcrumb">
<a href="${BASE_PATH}/">Schneelage</a><span>&gt;</span> Datenschutz
</div>
<h1>Datenschutzerkl\u00E4rung</h1>
<div class="legal-content">
<h2>Verantwortlicher</h2>
<p>[HIER DEINE DATEN EINTRAGEN]</p>
<h2>Datenerfassung auf dieser Website</h2>
<p>Diese Website verwendet keine Cookies und kein Tracking. Es werden keine personenbezogenen Daten gespeichert oder an Dritte weitergegeben.</p>
<h2>Externe Datenquellen</h2>
<p>Beim Laden der Seite werden Daten von folgenden externen Diensten abgerufen:</p>
<p>Open-Meteo API (Wetter- und Schneedaten), EAWS / avalanche.report (Lawinenwarnungen), SLF / WSL (Schweizer Lawinenwarnung), OpenHolidays API (Ferienkalender), Google Fonts (Schriftarten).</p>
<p>Dabei wird Ihre IP-Adresse an diese Dienste \u00FCbermittelt. Details zum Datenschutz der jeweiligen Dienste entnehmen Sie bitte deren Datenschutzerkl\u00E4rungen.</p>
<h2>Ihre Rechte</h2>
<p>Sie haben das Recht auf Auskunft, Berichtigung, L\u00F6schung und Einschr\u00E4nkung der Verarbeitung Ihrer personenbezogenen Daten. Kontaktieren Sie uns unter der oben genannten Adresse.</p>
</div>
</main>
${footer()}
</body>
</html>`;

  writeFileSync(join(pub, 'datenschutz', 'index.html'), html, 'utf8');
  console.log('  /datenschutz/');
}

// --- SITEMAP ---
function buildSitemap() {
  const urls = ['/'];

  resorts.forEach(r => urls.push('/' + r.slug + '/'));

  // Countries
  const countries = {};
  resorts.forEach(r => { countries[r.countrySlug] = true; });
  Object.keys(countries).forEach(c => urls.push('/' + c + '/'));

  // Regions
  const regions = {};
  resorts.forEach(r => { regions[r.regionSlug] = true; });
  Object.keys(regions).forEach(r => urls.push('/' + r + '/'));

  urls.push('/impressum/');
  urls.push('/datenschutz/');

  const today = new Date().toISOString().slice(0, 10);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  urls.forEach(u => {
    xml += `<url><loc>${DOMAIN}${u}</loc><lastmod>${today}</lastmod></url>\n`;
  });

  xml += '</urlset>';

  writeFileSync(join(pub, 'sitemap.xml'), xml, 'utf8');
  console.log('  sitemap.xml');
}

// --- ROBOTS.TXT ---
function buildRobots() {
  const txt = `User-agent: *
Allow: /

Sitemap: ${DOMAIN}/sitemap.xml
`;
  writeFileSync(join(pub, 'robots.txt'), txt, 'utf8');
  console.log('  robots.txt');
}

// --- BUILD ---
console.log('Building schneelage.app ...\n');

// Home
buildHome();

// Resort pages
resorts.forEach(r => buildResort(r));

// Group by region
const regionGroups = {};
resorts.forEach(r => {
  if (!regionGroups[r.regionSlug]) {
    regionGroups[r.regionSlug] = { name: r.region, countryName: r.countryName, countrySlug: r.countrySlug, resorts: [] };
  }
  regionGroups[r.regionSlug].resorts.push(r);
});

for (const [slug, info] of Object.entries(regionGroups)) {
  buildRegion(slug, info.name, info.resorts, info.countryName, info.countrySlug);
}

// Group by country
const countryGroups = {};
resorts.forEach(r => {
  if (!countryGroups[r.countrySlug]) {
    countryGroups[r.countrySlug] = { name: r.countryName, resorts: [] };
  }
  countryGroups[r.countrySlug].resorts.push(r);
});

for (const [slug, info] of Object.entries(countryGroups)) {
  buildCountry(slug, info.name, info.resorts);
}

// Legal
buildImpressum();
buildDatenschutz();

// Sitemap + robots
buildSitemap();
buildRobots();

console.log('\nDone. Output in public/');
