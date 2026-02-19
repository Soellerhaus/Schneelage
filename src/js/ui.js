(function () {
  'use strict';

  var CHF_TO_EUR = 1.05;

  // --- HELPERS ---
  function esc(str) {
    var d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate() {
    return new Date().toLocaleDateString('de-DE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  function formatPrice(resort) {
    var t = resort.tickets;
    if (!t) return '';
    if (t.currency === 'CHF') {
      var eur = Math.round(t.adult1Day * CHF_TO_EUR);
      return eur + '\u00A0\u20AC';
    }
    return Math.round(t.adult1Day) + '\u00A0\u20AC';
  }

  function formatPriceDetail(resort) {
    var t = resort.tickets;
    if (!t) return '';
    var s = t.adult1Day.toFixed(0) + '\u00A0' + t.currency;
    if (t.currency === 'CHF') {
      s += ' (~' + Math.round(t.adult1Day * CHF_TO_EUR) + '\u00A0\u20AC)';
    }
    return s;
  }

  // --- SKELETON ---
  function showSkeleton(target, count) {
    var html = '';
    for (var i = 0; i < count; i++) {
      html += '<div class="skeleton-row">' +
        '<div class="skeleton skeleton-cell w1"></div>' +
        '<div class="skeleton skeleton-cell w2"></div>' +
        '<div class="skeleton skeleton-cell w3"></div>' +
        '<div class="skeleton skeleton-cell w4"></div>' +
        '<div class="skeleton skeleton-cell w3"></div>' +
        '<div class="skeleton skeleton-cell w5"></div>' +
        '</div>';
    }
    target.innerHTML = html;
  }

  function showDetailSkeleton() {
    var el = document.getElementById('detail-content');
    if (!el) return;
    el.innerHTML = '<div class="skeleton skeleton-block"></div>' +
      '<div class="skeleton skeleton-block"></div>' +
      '<div class="skeleton skeleton-block"></div>';
  }

  // --- COPY PROTECTION ---
  function initProtection() {
    var els = document.querySelectorAll('.protected');
    els.forEach(function (el) {
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  // --- CROWD BAR (global) ---
  function renderCrowdBar(holidays, allResorts) {
    var el = document.getElementById('crowd-bar');
    if (!el) return;

    // Global: count total active holidays across all countries
    var todayStr = new Date().toISOString().slice(0, 10);
    var active = (holidays || []).filter(function (h) {
      return h.startDate <= todayStr && h.endDate >= todayStr;
    });

    var dayOfWeek = new Date().getDay();
    var dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

    // Collect unique subdivision shortNames
    var regionSet = {};
    active.forEach(function (h) {
      (h.subdivisions || []).forEach(function (s) { regionSet[s.shortName] = true; });
    });
    var regionCount = Object.keys(regionSet).length;

    var level, color;
    if (regionCount >= 10) { level = 'Sehr hoch'; color = '#dc2626'; }
    else if (regionCount >= 5) { level = 'Hoch'; color = '#f97316'; }
    else if (regionCount >= 2 || dayOfWeek === 6 || dayOfWeek === 0) { level = 'Mittel'; color = '#eab308'; }
    else { level = 'Gering'; color = '#22c55e'; }

    var detail = dayNames[dayOfWeek];
    if (regionCount > 0) {
      detail += ' + Ferien in ' + regionCount + ' Regionen';
    } else {
      detail += ', keine relevanten Ferien';
    }

    el.innerHTML = '<span>Erwartete Auslastung:</span> ' +
      '<span class="crowd-level" style="color:' + color + '">' + esc(level) + '</span> ' +
      '<span class="crowd-detail">\u2013 ' + esc(detail) + '</span>';
  }

  // --- RANKING TABLE (home + region + country) ---
  function renderRankingTable(resorts, holidays) {
    var body = document.getElementById('ranking-body');
    if (!body) return;

    showSkeleton(body, resorts.length);

    // Fetch data for all resorts in parallel
    var promises = resorts.map(function (r) {
      return Promise.all([
        window.fetchSnowData(r.lat, r.lon),
        window.fetchAvalancheRating(r.avalancheRegion, r.avalancheMicroRegion, r.country)
      ]).then(function (res) {
        return { resort: r, snow: res[0], aval: res[1] };
      });
    });

    Promise.all(promises).then(function (results) {
      // Calculate scores
      var rows = results.map(function (item) {
        var snow = item.snow;
        var aval = item.aval;
        var crowd = window.getResortCrowdLevel(holidays, item.resort.impactRegions);

        var depth = snow ? snow.currentDepth : 0;
        var newSnow3d = snow ? snow.newSnow3d : 0;
        var avgTemp = snow ? snow.avgTemp3d : 0;
        var trend = snow ? snow.trend : 0;
        var avalLevel = aval ? aval.level : 0;

        var score = window.calculateSkiScore(depth, newSnow3d, avgTemp, trend, crowd.level);
        var trendDir = window.getTrendDirection(depth, snow ? snow.depth3d : depth);

        return {
          resort: item.resort,
          score: score,
          depth: depth,
          newSnow3d: newSnow3d,
          trend: trendDir,
          avalLevel: avalLevel,
          price: formatPrice(item.resort)
        };
      });

      // Sort by score descending
      rows.sort(function (a, b) { return b.score - a.score; });

      var html = '';
      rows.forEach(function (row, idx) {
        var r = row.resort;
        var avalCls = 'aval-' + Math.min(5, Math.max(1, row.avalLevel));
        html += '<tr onclick="window.location.href=\'/' + esc(r.slug) + '/\'">' +
          '<td class="num">' + (idx + 1) + '</td>' +
          '<td><span class="resort-name">' + esc(r.name) + '</span><br>' +
          '<span class="resort-region">' + esc(r.region) + '</span></td>' +
          '<td class="num score-cell">' + row.score + '</td>' +
          '<td class="num" style="font-family:var(--font-mono)">' + row.depth + '<span style="font-size:0.65rem;color:var(--text-muted)">cm</span></td>' +
          '<td class="num" style="font-family:var(--font-mono)">' + row.newSnow3d + '<span style="font-size:0.65rem;color:var(--text-muted)">cm</span></td>' +
          '<td class="' + row.trend.cls + '" style="font-family:var(--font-mono);text-align:center">' + row.trend.arrow + '</td>' +
          '<td><span class="aval-dot ' + avalCls + '">' + (row.avalLevel || '-') + '</span></td>' +
          '<td class="num col-ticket"><span class="ticket-price">' + esc(row.price) + '</span></td>' +
          '<td class="col-country" style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted)">' + esc(r.country) + '</td>' +
          '</tr>';
      });

      body.innerHTML = html;
    }).catch(function () {
      body.innerHTML = '<tr><td colspan="9" class="error-msg">Daten konnten nicht geladen werden.</td></tr>';
    });
  }

  // --- DETAIL PAGE ---
  function renderDetailPage(resort) {
    var el = document.getElementById('detail-content');
    if (!el) return;

    showDetailSkeleton();

    window.fetchAllResortData(resort).then(function (data) {
      var snow = data.snow;
      var aval = data.avalanche;
      var holidays = data.holidays;
      var crowd = window.getResortCrowdLevel(holidays, resort.impactRegions);

      var depth = snow ? snow.currentDepth : 0;
      var newSnow3d = snow ? snow.newSnow3d : 0;
      var avgTemp = snow ? snow.avgTemp3d : 0;
      var trend = snow ? snow.trend : 0;
      var avalLevel = aval ? aval.level : 0;

      var score = window.calculateSkiScore(depth, newSnow3d, avgTemp, trend, crowd.level);
      var scoreLabel = window.getScoreLabel(score);
      var trendDir = window.getTrendDirection(depth, snow ? snow.depth3d : depth);

      var html = '<div class="detail-grid protected">';

      // Ski-Score
      html += '<div class="detail-block">' +
        '<h3>Ski-Score</h3>' +
        '<div class="score-big">' + score + '</div>' +
        '<div class="score-label">' + esc(scoreLabel) + '</div>' +
        '<div class="score-max">von 100 Punkten</div>' +
        '</div>';

      // Snow depth
      html += '<div class="detail-block">' +
        '<h3>Schneeh\u00F6he</h3>' +
        '<div class="snow-value">' + depth + '<span class="snow-unit">cm</span></div>' +
        '<div class="snow-elevation">' + resort.elevation.min + ' \u2013 ' + resort.elevation.max + ' m</div>' +
        '</div>';

      // Trend
      html += '<div class="detail-block">' +
        '<h3>Trend</h3>' +
        '<div class="trend-row">' +
        '<span>Heute ' + depth + 'cm</span>' +
        '<span class="trend-arrow ' + trendDir.cls + '">' + trendDir.arrow + '</span>' +
        '<span>3d ' + (snow ? snow.depth3d : depth) + 'cm</span>' +
        '<span class="trend-arrow ' + trendDir.cls + '">' + trendDir.arrow + '</span>' +
        '<span>7d ' + (snow ? snow.depth7d : depth) + 'cm</span>' +
        '</div>' +
        '<div style="font-size:0.75rem;color:var(--text-muted);margin-top:4px">Trend: ' + esc(trendDir.label) + '</div>' +
        '</div>';

      // Avalanche
      var avalColor = ['', 'var(--danger-1)', 'var(--danger-2)', 'var(--danger-3)', 'var(--danger-4)', 'var(--danger-5)'][avalLevel] || 'var(--border)';
      html += '<div class="detail-block">' +
        '<h3>Lawinenstufe</h3>' +
        '<div class="aval-text"><span class="aval-dot aval-' + Math.min(5, Math.max(1, avalLevel)) + '">' + (avalLevel || '-') + '</span> ' +
        esc(window.getAvalancheLabel(avalLevel)) + '</div>' +
        '<div class="aval-level-bar" style="background:' + avalColor + '"></div>';

      if (aval && aval.problems && aval.problems.length > 0) {
        html += '<ul class="aval-problems">';
        aval.problems.forEach(function (p) {
          html += '<li>' + esc(window.translateAvalancheProblem(p)) + '</li>';
        });
        html += '</ul>';
      }
      html += '</div>';

      // Neuschnee 7d bars
      html += '<div class="detail-block" style="grid-column: span 2">' +
        '<h3>Neuschnee 7 Tage</h3>';
      if (snow && snow.snowfallDaily.length > 0) {
        var maxSnow = Math.max.apply(null, snow.snowfallDaily.concat([1]));
        html += '<div class="newsnow-bars">';
        snow.snowfallDaily.forEach(function (val) {
          var h = Math.max(2, (val / maxSnow) * 60);
          html += '<div class="newsnow-bar" style="height:' + h + 'px">' +
            (val > 0 ? '<span class="newsnow-bar-label">' + val + '</span>' : '') +
            '</div>';
        });
        html += '</div><div class="newsnow-days">';
        var dayAbbr = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        (snow.dailyDates || []).forEach(function (d) {
          var dt = new Date(d + 'T00:00:00');
          html += '<div class="newsnow-day">' + dayAbbr[dt.getDay()] + '</div>';
        });
        html += '</div>';
      } else {
        html += '<div style="font-size:0.78rem;color:var(--text-muted)">Keine Daten verf\u00FCgbar</div>';
      }
      html += '</div>';

      // Weather 7d
      html += '<div class="detail-block" style="grid-column: span 2">' +
        '<h3>Wetter 7 Tage</h3>';
      if (snow && snow.dailyDates && snow.dailyDates.length > 0) {
        var dayAbbr2 = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
        html += '<div class="weather-row">';
        snow.dailyDates.forEach(function (d, i) {
          var dt = new Date(d + 'T00:00:00');
          var maxT = snow.maxTemps[i] !== undefined ? Math.round(snow.maxTemps[i]) : '-';
          var minT = snow.minTemps[i] !== undefined ? Math.round(snow.minTemps[i]) : '-';
          html += '<div class="weather-day">' +
            '<div class="day-name">' + dayAbbr2[dt.getDay()] + '</div>' +
            '<div class="temp-max">' + maxT + '\u00B0</div>' +
            '<div class="temp-min">' + minT + '\u00B0</div>' +
            '</div>';
        });
        html += '</div>';
      }
      html += '</div>';

      // Crowd level
      html += '<div class="detail-block">' +
        '<h3>Erwartete Auslastung</h3>' +
        '<div class="crowd-label-big" style="color:' + crowd.color + '">' + esc(crowd.label) + '</div>' +
        '<div class="crowd-block-bar" style="background:' + crowd.color + '"></div>' +
        '<div class="crowd-detail-text">' + esc(crowd.dayOfWeek) + ' \u2013 ' + esc(crowd.dayHint) + '</div>';

      if (crowd.activeNames.length > 0) {
        html += '<div style="margin-top:6px;font-size:0.75rem;color:var(--text-muted)">Aktive Ferien im Einzugsgebiet:</div>' +
          '<ul class="crowd-ferien-list">';
        crowd.activeNames.forEach(function (n) {
          html += '<li>' + esc(n) + '</li>';
        });
        html += '</ul>';
      }

      if (crowd.level === 'hoch' || crowd.level === 'sehr_hoch') {
        html += '<div class="crowd-tip">Tipp: Unter der Woche (Di\u2013Do) ist es deutlich ruhiger.</div>';
      }
      html += '</div>';

      // Peak periods calendar
      html += '<div class="detail-block" style="grid-column: span 2">' +
        '<h3>Saison\u00FCbersicht Auslastung</h3>';
      html += renderPeakCalendar(resort.peakPeriods);
      html += '</div>';

      // Ticket price
      html += '<div class="detail-block">' +
        '<h3>Skipass</h3>' +
        '<div class="ticket-detail">' +
        '<div class="ticket-big">' + formatPriceDetail(resort) + '</div>' +
        '<div class="ticket-small">Tagesticket Erwachsene, Hauptsaison ' + esc(resort.tickets.season) + '</div>' +
        '</div>';
      if (resort.tickets.source) {
        html += '<a class="ticket-link" href="' + esc(resort.tickets.source) + '" target="_blank" rel="noopener">Offizielle Preise \u2192</a>';
      }
      html += '</div>';

      // Neighbors
      html += '<div class="detail-block">' +
        '<h3>In der N\u00E4he</h3>' +
        '<div class="neighbors">';
      (resort.neighbors || []).forEach(function (slug) {
        var allResorts = JSON.parse(document.getElementById('all-resorts-data').textContent || '[]');
        var nr = allResorts.find(function (x) { return x.slug === slug; });
        if (nr) {
          html += '<a class="neighbor-link" href="/' + esc(nr.slug) + '/">' + esc(nr.name) + '</a>';
        }
      });
      html += '</div>' +
        '<a class="booking-link" href="https://www.booking.com/searchresults.html?ss=' + encodeURIComponent(resort.name) + '&aid=AFFILIATE_ID" target="_blank" rel="noopener nofollow">Unterk\u00FCnfte in ' + esc(resort.name) + ' \u2192</a>' +
        '</div>';

      html += '</div>'; // close detail-grid

      el.innerHTML = html;
      initProtection();

    }).catch(function (e) {
      console.warn('Detail render error:', e);
      el.innerHTML = '<div class="error-msg">Daten konnten nicht geladen werden. Bitte sp\u00E4ter erneut versuchen.</div>';
    });
  }

  // --- PEAK CALENDAR RENDER ---
  function renderPeakCalendar(periods) {
    if (!periods || periods.length === 0) return '';

    // Season: Dec 1 2025 to Apr 30 2026
    var seasonStart = new Date('2025-12-01');
    var seasonEnd = new Date('2026-04-30');
    var totalDays = (seasonEnd - seasonStart) / 86400000;

    function dayPos(dateStr) {
      var d = new Date(dateStr);
      var diff = (d - seasonStart) / 86400000;
      return Math.max(0, Math.min(100, (diff / totalDays) * 100));
    }

    var html = '<div class="peak-calendar">';

    periods.forEach(function (p) {
      var left = dayPos(p.from);
      var right = dayPos(p.to);
      var width = right - left;
      html += '<div class="peak-period peak-' + p.level + '" style="left:' + left + '%;width:' + width + '%" title="' + esc(p.label) + '"></div>';
    });

    // Today marker
    var todayPos = dayPos(new Date().toISOString().slice(0, 10));
    html += '<div class="peak-today" style="left:' + todayPos + '%" title="Heute"></div>';
    html += '</div>';

    html += '<div class="peak-months">' +
      '<span>Dez</span><span>Jan</span><span>Feb</span><span>Mrz</span><span>Apr</span>' +
      '</div>';

    html += '<div class="peak-legend">' +
      '<span><span class="peak-legend-dot" style="background:var(--danger-4)"></span>Extrem</span>' +
      '<span><span class="peak-legend-dot" style="background:var(--danger-3)"></span>Sehr hoch</span>' +
      '<span><span class="peak-legend-dot" style="background:var(--danger-2)"></span>Hoch</span>' +
      '<span style="color:var(--accent)">| Heute</span>' +
      '</div>';

    return html;
  }

  // --- DATE DISPLAY ---
  function renderDate() {
    var el = document.getElementById('date-display');
    if (el) el.textContent = formatDate();
  }

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', function () {
    renderDate();
    initProtection();

    var body = document.body;
    var page = body.getAttribute('data-page');

    if (page === 'home' || page === 'region' || page === 'country') {
      var resortsEl = document.getElementById('page-resorts-data');
      if (!resortsEl) return;
      var resorts;
      try { resorts = JSON.parse(resortsEl.textContent); } catch (e) { return; }

      window.fetchHolidays().then(function (holidays) {
        renderCrowdBar(holidays, resorts);
        renderRankingTable(resorts, holidays);
      });
    }

    if (page === 'resort') {
      var resortEl = document.getElementById('page-resort-data');
      if (!resortEl) return;
      var resort;
      try { resort = JSON.parse(resortEl.textContent); } catch (e) { return; }
      renderDetailPage(resort);
    }
  });

})();
