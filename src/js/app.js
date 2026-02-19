(function () {
  'use strict';

  // === API ===
  function _m() { return atob('aHR0cHM6Ly9hcGkub3Blbi1tZXRlby5jb20vdjEvZm9yZWNhc3Q='); }
  function _e() { return atob('aHR0cHM6Ly9zdGF0aWMuYXZhbGFuY2hlLnJlcG9ydC9lYXdzX2J1bGxldGlucw=='); }
  function _s() { return atob('aHR0cHM6Ly9hd3Muc2xmLmNoL2FwaS9idWxsZXRpbi9jYWFtbC9kZS9qc29u'); }
  function _h() { return atob('aHR0cHM6Ly9vcGVuaG9saWRheXNhcGkub3Jn'); }

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function weekFromNow() { var d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); }

  window.fetchSnowData = async function (lat, lon) {
    try {
      var url = _m() + '?latitude=' + lat + '&longitude=' + lon +
        '&hourly=snow_depth,snowfall&daily=snowfall_sum,temperature_2m_max,temperature_2m_min' +
        '&timezone=Europe/Berlin&forecast_days=7';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var hourly = data.hourly || {}, daily = data.daily || {};
      var depths = hourly.snow_depth || [];
      var currentDepthCm = Math.round((depths[0] || 0) * 100);
      var depth3d = depths.length > 72 ? depths[72] : depths[depths.length - 1] || 0;
      var depth3dCm = Math.round(depth3d * 100);
      var depth7d = depths.length > 0 ? depths[depths.length - 1] : 0;
      var depth7dCm = Math.round(depth7d * 100);
      var snowfallDaily = daily.snowfall_sum || [];
      var newSnow3d = 0;
      for (var i = 0; i < Math.min(3, snowfallDaily.length); i++) newSnow3d += snowfallDaily[i] || 0;
      newSnow3d = Math.round(newSnow3d * 10) / 10;
      var maxTemps = daily.temperature_2m_max || [], minTemps = daily.temperature_2m_min || [];
      var tempSum = 0, tempCount = 0;
      for (var j = 0; j < Math.min(3, maxTemps.length); j++) {
        tempSum += ((maxTemps[j] || 0) + (minTemps[j] || 0)) / 2; tempCount++;
      }
      var avgTemp3d = tempCount > 0 ? Math.round((tempSum / tempCount) * 10) / 10 : 0;
      return {
        currentDepth: currentDepthCm, depth3d: depth3dCm, depth7d: depth7dCm,
        newSnow3d: newSnow3d,
        snowfallDaily: snowfallDaily.map(function (v) { return Math.round((v || 0) * 10) / 10; }),
        avgTemp3d: avgTemp3d, trend: depth3dCm - currentDepthCm,
        maxTemps: maxTemps, minTemps: minTemps, dailyDates: daily.time || []
      };
    } catch (e) { console.warn('Snow data error:', e); return null; }
  };

  window.fetchAvalancheEAWS = async function (region, microRegion) {
    try {
      var date = todayStr();
      var url = _e() + '/' + date + '/' + date + '-' + region + '.ratings.json';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var ratings = data.maxDangerRatings || {};
      if (microRegion && ratings[microRegion] !== undefined) return { level: ratings[microRegion], source: 'eaws' };
      var maxLevel = 0;
      var prefix = microRegion ? microRegion.split('-').slice(0, -1).join('-') : region;
      for (var key in ratings) { if (key.indexOf(prefix) === 0 && !key.includes(':') && ratings[key] > maxLevel) maxLevel = ratings[key]; }
      if (maxLevel > 0) return { level: maxLevel, source: 'eaws' };
      for (var k in ratings) { if (!k.includes(':') && ratings[k] > maxLevel) maxLevel = ratings[k]; }
      return { level: maxLevel || 0, source: 'eaws' };
    } catch (e) { console.warn('EAWS error:', e); return null; }
  };

  window.fetchAvalancheSLF = async function (microRegion) {
    try {
      var res = await fetch(_s());
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var bulletins = data.bulletins || [];
      var levelMap = { 'low': 1, 'moderate': 2, 'considerable': 3, 'high': 4, 'very_high': 5 };
      for (var i = 0; i < bulletins.length; i++) {
        var b = bulletins[i], regions = b.regions || [], found = false;
        for (var j = 0; j < regions.length; j++) { if (regions[j].regionID === microRegion) { found = true; break; } }
        if (found && b.dangerRatings && b.dangerRatings.length > 0) {
          var mainVal = b.dangerRatings[0].mainValue || 'low';
          var problems = (b.avalancheProblems || []).map(function (p) { return p.problemType; });
          return { level: levelMap[mainVal] || 0, source: 'slf', problems: problems };
        }
      }
      return null;
    } catch (e) { console.warn('SLF error:', e); return null; }
  };

  window.fetchAvalancheRating = async function (region, microRegion, country) {
    if (country === 'CH') return await window.fetchAvalancheSLF(microRegion);
    return await window.fetchAvalancheEAWS(region, microRegion);
  };

  window.fetchHolidays = async function () {
    try {
      var countries = ['AT', 'DE', 'CH', 'NL', 'BE'];
      var from = todayStr(), to = weekFromNow(), all = [];
      var promises = countries.map(function (cc) {
        var url = _h() + '/SchoolHolidays?countryIsoCode=' + cc + '&validFrom=' + from + '&validTo=' + to + '&languageIsoCode=DE';
        return fetch(url).then(function (r) { return r.ok ? r.json() : []; }).then(function (arr) {
          return (Array.isArray(arr) ? arr : []).map(function (h) { h.countryIsoCode = cc; return h; });
        }).catch(function () { return []; });
      });
      var results = await Promise.all(promises);
      for (var i = 0; i < results.length; i++) all = all.concat(results[i]);
      return all;
    } catch (e) { console.warn('Holidays error:', e); return []; }
  };

  window.fetchAllResortData = async function (resort) {
    var r = await Promise.all([
      window.fetchSnowData(resort.lat, resort.lon),
      window.fetchAvalancheRating(resort.avalancheRegion, resort.avalancheMicroRegion, resort.country),
      window.fetchHolidays()
    ]);
    return { snow: r[0], avalanche: r[1], holidays: r[2] };
  };

  // === SCORE ===
  window.calculateSkiScore = function (snow, newSnow3d, avgTemp3d, trend, crowdLevel) {
    var sS = Math.min(30, (snow / 120) * 30);
    var sN = Math.min(25, (newSnow3d / 10) * 25);
    var sT = avgTemp3d < -5 ? 20 : avgTemp3d < 0 ? 15 : avgTemp3d < 5 ? 10 : 5;
    var sTr = trend > 10 ? 15 : trend > 0 ? 10 : trend > -10 ? 5 : 0;
    var cM = { gering: 10, mittel: 7, hoch: 3, sehr_hoch: 1 };
    return Math.round(sS + sN + sT + sTr + (cM[crowdLevel] || 5));
  };

  window.getScoreLabel = function (score) {
    if (score >= 80) return 'Hervorragend';
    if (score >= 60) return 'Sehr gut';
    if (score >= 40) return 'Gut';
    if (score >= 20) return 'M\u00E4\u00DFig';
    return 'Schlecht';
  };

  window.getTrendDirection = function (current, future) {
    var diff = future - current;
    if (diff > 2) return { arrow: '\u2191', cls: 'trend-up', label: 'steigend' };
    if (diff < -2) return { arrow: '\u2193', cls: 'trend-down', label: 'fallend' };
    return { arrow: '\u2192', cls: 'trend-stable', label: 'stabil' };
  };

  window.getResortCrowdLevel = function (holidays, impactRegions) {
    var today = new Date(), ts = today.toISOString().slice(0, 10), dow = today.getDay();
    var active = (holidays || []).filter(function (h) { return h.startDate <= ts && h.endDate >= ts; });
    var ferienCount = 0, activeNames = [];
    active.forEach(function (h) {
      var codes = (h.subdivisions || []).map(function (s) { return s.code; });
      var cc = h.countryIsoCode || '';
      if (codes.some(function (c) { return impactRegions.indexOf(c) !== -1; }) || impactRegions.indexOf(cc) !== -1) {
        ferienCount++;
        var nm = '';
        if (h.name && h.name.length > 0) { var de = h.name.find(function (n) { return n.language === 'DE'; }); nm = de ? de.text : h.name[0].text; }
        var rg = (h.subdivisions || []).map(function (s) { return s.shortName; }).join(', ');
        if (nm) activeNames.push(nm + (rg ? ' (' + rg + ')' : ''));
      }
    });
    var dF = { 0: 1.3, 1: 0.7, 2: 0.6, 3: 0.6, 4: 0.7, 5: 1.2, 6: 1.5 };
    var score = ferienCount * dF[dow];
    var level, label, color;
    if (score >= 4.0) { level = 'sehr_hoch'; label = 'Sehr hoch'; color = '#dc2626'; }
    else if (score >= 2.5) { level = 'hoch'; label = 'Hoch'; color = '#f97316'; }
    else if (score >= 1.0 || (ferienCount === 0 && dow === 6)) { level = 'mittel'; label = 'Mittel'; color = '#eab308'; }
    else if (ferienCount === 0 && dow >= 1 && dow <= 4) { level = 'gering'; label = 'Gering'; color = '#22c55e'; }
    else { level = 'mittel'; label = 'Mittel'; color = '#eab308'; }
    var dn = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    var dayHint = (dow === 6 || dow === 0) ? 'Wochenende \u2013 generell mehr Betrieb' : (dow >= 1 && dow <= 4) ? 'Wochentag \u2013 tendenziell ruhiger' : 'Freitag \u2013 Anreisetag, zunehmender Betrieb';
    return { level: level, label: label, color: color, ferienCount: ferienCount, activeNames: activeNames, dayOfWeek: dn[dow], dayHint: dayHint, score: Math.round(score * 10) / 10 };
  };

  window.translateAvalancheProblem = function (type) {
    var m = { 'new_snow': 'Neuschnee', 'wind_slab': 'Triebschnee', 'persistent_weak_layers': 'Altschneeproblem', 'wet_snow': 'Nassschnee', 'gliding_snow': 'Gleitschnee' };
    return m[type] || type;
  };

  window.getAvalancheLabel = function (level) {
    var l = { 1: 'Gering', 2: 'M\u00E4\u00DFig', 3: 'Erheblich', 4: 'Gro\u00DF', 5: 'Sehr gro\u00DF' };
    return l[level] || 'Unbekannt';
  };

  // === UI ===
  var CHF_TO_EUR = 1.05;

  function esc(str) { var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  function formatDate() {
    return new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  function formatPrice(resort) {
    var t = resort.tickets; if (!t) return '';
    if (t.currency === 'CHF') return Math.round(t.adult1Day * CHF_TO_EUR) + '\u00A0\u20AC';
    return Math.round(t.adult1Day) + '\u00A0\u20AC';
  }

  function formatPriceDetail(resort) {
    var t = resort.tickets; if (!t) return '';
    var s = t.adult1Day.toFixed(0) + '\u00A0' + t.currency;
    if (t.currency === 'CHF') s += ' (~' + Math.round(t.adult1Day * CHF_TO_EUR) + '\u00A0\u20AC)';
    return s;
  }

  function showSkeleton(target, count) {
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '<div class="skeleton-row"><div class="skeleton skeleton-cell w1"></div><div class="skeleton skeleton-cell w2"></div><div class="skeleton skeleton-cell w3"></div><div class="skeleton skeleton-cell w4"></div><div class="skeleton skeleton-cell w3"></div><div class="skeleton skeleton-cell w5"></div></div>';
    }
    target.innerHTML = html;
  }

  function showDetailSkeleton() {
    var el = document.getElementById('detail-content'); if (!el) return;
    el.innerHTML = '<div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div><div class="skeleton skeleton-block"></div>';
  }

  function initProtection() {
    document.querySelectorAll('.protected').forEach(function (el) {
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  function renderCrowdBar(holidays) {
    var el = document.getElementById('crowd-bar'); if (!el) return;
    var ts = new Date().toISOString().slice(0, 10);
    var active = (holidays || []).filter(function (h) { return h.startDate <= ts && h.endDate >= ts; });
    var dow = new Date().getDay();
    var dn = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    var rSet = {};
    active.forEach(function (h) { (h.subdivisions || []).forEach(function (s) { rSet[s.shortName] = true; }); });
    var rc = Object.keys(rSet).length;
    var level, color;
    if (rc >= 10) { level = 'Sehr hoch'; color = '#dc2626'; }
    else if (rc >= 5) { level = 'Hoch'; color = '#f97316'; }
    else if (rc >= 2 || dow === 6 || dow === 0) { level = 'Mittel'; color = '#eab308'; }
    else { level = 'Gering'; color = '#22c55e'; }
    var detail = dn[dow] + (rc > 0 ? ' + Ferien in ' + rc + ' Regionen' : ', keine relevanten Ferien');
    el.innerHTML = '<span>Erwartete Auslastung:</span> <span class="crowd-level" style="color:' + color + '">' + esc(level) + '</span> <span class="crowd-detail">\u2013 ' + esc(detail) + '</span>';
  }

  function renderRankingTable(resorts, holidays) {
    var body = document.getElementById('ranking-body'); if (!body) return;
    showSkeleton(body, resorts.length);
    var promises = resorts.map(function (r) {
      return Promise.all([window.fetchSnowData(r.lat, r.lon), window.fetchAvalancheRating(r.avalancheRegion, r.avalancheMicroRegion, r.country)])
        .then(function (res) { return { resort: r, snow: res[0], aval: res[1] }; });
    });
    Promise.all(promises).then(function (results) {
      var rows = results.map(function (item) {
        var sn = item.snow, av = item.aval;
        var crowd = window.getResortCrowdLevel(holidays, item.resort.impactRegions);
        var d = sn ? sn.currentDepth : 0, n3 = sn ? sn.newSnow3d : 0, at = sn ? sn.avgTemp3d : 0, tr = sn ? sn.trend : 0, al = av ? av.level : 0;
        return { resort: item.resort, score: window.calculateSkiScore(d, n3, at, tr, crowd.level), depth: d, newSnow3d: n3, trend: window.getTrendDirection(d, sn ? sn.depth3d : d), avalLevel: al, price: formatPrice(item.resort) };
      });
      rows.sort(function (a, b) { return b.score - a.score; });
      var html = '';
      rows.forEach(function (row, idx) {
        var r = row.resort, ac = 'aval-' + Math.min(5, Math.max(1, row.avalLevel));
        html += '<tr onclick="window.location.href=\'/' + esc(r.slug) + '/\'">' +
          '<td class="num">' + (idx + 1) + '</td>' +
          '<td><span class="resort-name">' + esc(r.name) + '</span><br><span class="resort-region">' + esc(r.region) + '</span></td>' +
          '<td class="num score-cell">' + row.score + '</td>' +
          '<td class="num" style="font-family:var(--font-mono)">' + row.depth + '<span style="font-size:0.65rem;color:var(--text-muted)">cm</span></td>' +
          '<td class="num" style="font-family:var(--font-mono)">' + row.newSnow3d + '<span style="font-size:0.65rem;color:var(--text-muted)">cm</span></td>' +
          '<td class="' + row.trend.cls + '" style="font-family:var(--font-mono);text-align:center">' + row.trend.arrow + '</td>' +
          '<td><span class="aval-dot ' + ac + '">' + (row.avalLevel || '-') + '</span></td>' +
          '<td class="num col-ticket"><span class="ticket-price">' + esc(row.price) + '</span></td>' +
          '<td class="col-country" style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted)">' + esc(r.country) + '</td></tr>';
      });
      body.innerHTML = html;
    }).catch(function () { body.innerHTML = '<tr><td colspan="9" class="error-msg">Daten konnten nicht geladen werden.</td></tr>'; });
  }

  function renderPeakCalendar(periods) {
    if (!periods || periods.length === 0) return '';
    var sStart = new Date('2025-12-01'), sEnd = new Date('2026-04-30');
    var total = (sEnd - sStart) / 86400000;
    function pos(ds) { var diff = (new Date(ds) - sStart) / 86400000; return Math.max(0, Math.min(100, (diff / total) * 100)); }
    var html = '<div class="peak-calendar">';
    periods.forEach(function (p) { var l = pos(p.from), w = pos(p.to) - l; html += '<div class="peak-period peak-' + p.level + '" style="left:' + l + '%;width:' + w + '%" title="' + esc(p.label) + '"></div>'; });
    html += '<div class="peak-today" style="left:' + pos(todayStr()) + '%" title="Heute"></div></div>';
    html += '<div class="peak-months"><span>Dez</span><span>Jan</span><span>Feb</span><span>Mrz</span><span>Apr</span></div>';
    html += '<div class="peak-legend"><span><span class="peak-legend-dot" style="background:var(--danger-4)"></span>Extrem</span><span><span class="peak-legend-dot" style="background:var(--danger-3)"></span>Sehr hoch</span><span><span class="peak-legend-dot" style="background:var(--danger-2)"></span>Hoch</span><span style="color:var(--accent)">| Heute</span></div>';
    return html;
  }

  function renderDetailPage(resort) {
    var el = document.getElementById('detail-content'); if (!el) return;
    showDetailSkeleton();
    window.fetchAllResortData(resort).then(function (data) {
      var sn = data.snow, av = data.avalanche, hol = data.holidays;
      var crowd = window.getResortCrowdLevel(hol, resort.impactRegions);
      var d = sn ? sn.currentDepth : 0, n3 = sn ? sn.newSnow3d : 0, at = sn ? sn.avgTemp3d : 0, tr = sn ? sn.trend : 0, al = av ? av.level : 0;
      var score = window.calculateSkiScore(d, n3, at, tr, crowd.level);
      var sLabel = window.getScoreLabel(score);
      var tDir = window.getTrendDirection(d, sn ? sn.depth3d : d);

      var html = '<div class="detail-grid protected">';
      // Ski-Score
      html += '<div class="detail-block"><h3>Ski-Score</h3><div class="score-big">' + score + '</div><div class="score-label">' + esc(sLabel) + '</div><div class="score-max">von 100 Punkten</div></div>';
      // Snow depth
      html += '<div class="detail-block"><h3>Schneeh\u00F6he</h3><div class="snow-value">' + d + '<span class="snow-unit">cm</span></div><div class="snow-elevation">' + resort.elevation.min + ' \u2013 ' + resort.elevation.max + ' m</div></div>';
      // Trend
      html += '<div class="detail-block"><h3>Trend</h3><div class="trend-row"><span>Heute ' + d + 'cm</span><span class="trend-arrow ' + tDir.cls + '">' + tDir.arrow + '</span><span>3d ' + (sn ? sn.depth3d : d) + 'cm</span><span class="trend-arrow ' + tDir.cls + '">' + tDir.arrow + '</span><span>7d ' + (sn ? sn.depth7d : d) + 'cm</span></div><div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Trend: ' + esc(tDir.label) + '</div></div>';
      // Avalanche
      var aC = ['', 'var(--danger-1)', 'var(--danger-2)', 'var(--danger-3)', 'var(--danger-4)', 'var(--danger-5)'][al] || 'var(--border)';
      html += '<div class="detail-block"><h3>Lawinenstufe</h3><div class="aval-text"><span class="aval-dot aval-' + Math.min(5, Math.max(1, al)) + '">' + (al || '-') + '</span> ' + esc(window.getAvalancheLabel(al)) + '</div><div class="aval-level-bar" style="background:' + aC + '"></div>';
      if (av && av.problems && av.problems.length > 0) { html += '<ul class="aval-problems">'; av.problems.forEach(function (p) { html += '<li>' + esc(window.translateAvalancheProblem(p)) + '</li>'; }); html += '</ul>'; }
      html += '</div>';
      // Neuschnee 7d
      html += '<div class="detail-block" style="grid-column:span 2"><h3>Neuschnee 7 Tage</h3>';
      if (sn && sn.snowfallDaily.length > 0) {
        var mx = Math.max.apply(null, sn.snowfallDaily.concat([1]));
        html += '<div class="newsnow-bars">'; sn.snowfallDaily.forEach(function (v) { var h = Math.max(2, (v / mx) * 60); html += '<div class="newsnow-bar" style="height:' + h + 'px">' + (v > 0 ? '<span class="newsnow-bar-label">' + v + '</span>' : '') + '</div>'; }); html += '</div><div class="newsnow-days">';
        var da = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        (sn.dailyDates || []).forEach(function (dt) { html += '<div class="newsnow-day">' + da[new Date(dt + 'T00:00:00').getDay()] + '</div>'; }); html += '</div>';
      } else { html += '<div style="font-size:0.78rem;color:var(--text-muted)">Keine Daten verf\u00FCgbar</div>'; }
      html += '</div>';
      // Weather 7d
      html += '<div class="detail-block" style="grid-column:span 2"><h3>Wetter 7 Tage</h3>';
      if (sn && sn.dailyDates && sn.dailyDates.length > 0) {
        var da2 = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        html += '<div class="weather-row">'; sn.dailyDates.forEach(function (dt, i) { var dd = new Date(dt + 'T00:00:00'); html += '<div class="weather-day"><div class="day-name">' + da2[dd.getDay()] + '</div><div class="temp-max">' + (sn.maxTemps[i] !== undefined ? Math.round(sn.maxTemps[i]) : '-') + '\u00B0</div><div class="temp-min">' + (sn.minTemps[i] !== undefined ? Math.round(sn.minTemps[i]) : '-') + '\u00B0</div></div>'; }); html += '</div>';
      }
      html += '</div>';
      // Crowd
      html += '<div class="detail-block"><h3>Erwartete Auslastung</h3><div class="crowd-label-big" style="color:' + crowd.color + '">' + esc(crowd.label) + '</div><div class="crowd-block-bar" style="background:' + crowd.color + '"></div><div class="crowd-detail-text">' + esc(crowd.dayOfWeek) + ' \u2013 ' + esc(crowd.dayHint) + '</div>';
      if (crowd.activeNames.length > 0) { html += '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-muted)">Aktive Ferien im Einzugsgebiet:</div><ul class="crowd-ferien-list">'; crowd.activeNames.forEach(function (n) { html += '<li>' + esc(n) + '</li>'; }); html += '</ul>'; }
      if (crowd.level === 'hoch' || crowd.level === 'sehr_hoch') html += '<div class="crowd-tip">Tipp: Unter der Woche (Di\u2013Do) ist es deutlich ruhiger.</div>';
      html += '</div>';
      // Peak calendar
      html += '<div class="detail-block" style="grid-column:span 2"><h3>Saison\u00FCbersicht Auslastung</h3>' + renderPeakCalendar(resort.peakPeriods) + '</div>';
      // Ticket
      html += '<div class="detail-block"><h3>Skipass</h3><div class="ticket-detail"><div class="ticket-big">' + formatPriceDetail(resort) + '</div><div class="ticket-small">Tagesticket Erwachsene, Hauptsaison ' + esc(resort.tickets.season) + '</div></div>';
      if (resort.tickets.source) html += '<a class="ticket-link" href="' + esc(resort.tickets.source) + '" target="_blank" rel="noopener">Offizielle Preise \u2192</a>';
      html += '</div>';
      // Neighbors
      html += '<div class="detail-block"><h3>In der N\u00E4he</h3><div class="neighbors">';
      var allR = JSON.parse(document.getElementById('all-resorts-data').textContent || '[]');
      (resort.neighbors || []).forEach(function (slug) { var nr = allR.find(function (x) { return x.slug === slug; }); if (nr) html += '<a class="neighbor-link" href="/' + esc(nr.slug) + '/">' + esc(nr.name) + '</a>'; });
      html += '</div><a class="booking-link" href="https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(resort.name) + '&aid=AFFILIATE_ID" target="_blank" rel="noopener nofollow">Unterk\u00FCnfte in ' + esc(resort.name) + ' \u2192</a></div>';
      html += '</div>';
      el.innerHTML = html;
      initProtection();
    }).catch(function (e) { console.warn('Detail render error:', e); el.innerHTML = '<div class="error-msg">Daten konnten nicht geladen werden. Bitte sp\u00E4ter erneut versuchen.</div>'; });
  }

  // === INIT ===
  document.addEventListener('DOMContentLoaded', function () {
    var dateEl = document.getElementById('date-display');
    if (dateEl) dateEl.textContent = formatDate();
    initProtection();
    var page = document.body.getAttribute('data-page');
    if (page === 'home' || page === 'region' || page === 'country') {
      var rEl = document.getElementById('page-resorts-data'); if (!rEl) return;
      var resorts; try { resorts = JSON.parse(rEl.textContent); } catch (e) { return; }
      window.fetchHolidays().then(function (holidays) { renderCrowdBar(holidays); renderRankingTable(resorts, holidays); });
    }
    if (page === 'resort') {
      var sEl = document.getElementById('page-resort-data'); if (!sEl) return;
      var resort; try { resort = JSON.parse(sEl.textContent); } catch (e) { return; }
      renderDetailPage(resort);
    }
  });
})();
