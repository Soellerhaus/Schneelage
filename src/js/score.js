(function () {
  'use strict';

  window.calculateSkiScore = function (snow, newSnow3d, avgTemp3d, trend, crowdLevel) {
    var scoreSnow = Math.min(30, (snow / 120) * 30);
    var scoreNewSnow = Math.min(25, (newSnow3d / 10) * 25);
    var scoreTemp = avgTemp3d < -5 ? 20 : avgTemp3d < 0 ? 15 : avgTemp3d < 5 ? 10 : 5;
    var scoreTrend = trend > 10 ? 15 : trend > 0 ? 10 : trend > -10 ? 5 : 0;
    var crowdMap = { gering: 10, mittel: 7, hoch: 3, sehr_hoch: 1 };
    var scoreCrowd = crowdMap[crowdLevel] || 5;
    return Math.round(scoreSnow + scoreNewSnow + scoreTemp + scoreTrend + scoreCrowd);
  };

  window.getScoreLabel = function (score) {
    if (score >= 80) return 'Hervorragend';
    if (score >= 60) return 'Sehr gut';
    if (score >= 40) return 'Gut';
    if (score >= 20) return 'Mäßig';
    return 'Schlecht';
  };

  window.getTrendDirection = function (current, future) {
    var diff = future - current;
    if (diff > 2) return { arrow: '\u2191', cls: 'trend-up', label: 'steigend' };
    if (diff < -2) return { arrow: '\u2193', cls: 'trend-down', label: 'fallend' };
    return { arrow: '\u2192', cls: 'trend-stable', label: 'stabil' };
  };

  window.getResortCrowdLevel = function (holidays, impactRegions) {
    var today = new Date();
    var todayStr = today.toISOString().slice(0, 10);
    var dayOfWeek = today.getDay();

    var active = (holidays || []).filter(function (h) {
      return h.startDate <= todayStr && h.endDate >= todayStr;
    });

    var ferienCount = 0;
    var activeNames = [];

    active.forEach(function (h) {
      var codes = (h.subdivisions || []).map(function (s) { return s.code; });
      var cc = h.countryIsoCode || '';
      if (codes.some(function (c) { return impactRegions.indexOf(c) !== -1; }) ||
          impactRegions.indexOf(cc) !== -1) {
        ferienCount++;
        var name = '';
        if (h.name && h.name.length > 0) {
          var de = h.name.find(function (n) { return n.language === 'DE'; });
          name = de ? de.text : h.name[0].text;
        }
        var regions = (h.subdivisions || []).map(function (s) { return s.shortName; }).join(', ');
        if (name) activeNames.push(name + (regions ? ' (' + regions + ')' : ''));
      }
    });

    var dayFactor = { 0: 1.3, 1: 0.7, 2: 0.6, 3: 0.6, 4: 0.7, 5: 1.2, 6: 1.5 };
    var factor = dayFactor[dayOfWeek];
    var score = ferienCount * factor;

    var level, label, color;
    if (score >= 4.0) {
      level = 'sehr_hoch'; label = 'Sehr hoch'; color = '#dc2626';
    } else if (score >= 2.5) {
      level = 'hoch'; label = 'Hoch'; color = '#f97316';
    } else if (score >= 1.0 || (ferienCount === 0 && dayOfWeek === 6)) {
      level = 'mittel'; label = 'Mittel'; color = '#eab308';
    } else if (ferienCount === 0 && dayOfWeek >= 1 && dayOfWeek <= 4) {
      level = 'gering'; label = 'Gering'; color = '#22c55e';
    } else {
      level = 'mittel'; label = 'Mittel'; color = '#eab308';
    }

    var dayNames = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    var dayHint;
    if (dayOfWeek === 6 || dayOfWeek === 0) {
      dayHint = 'Wochenende \u2013 generell mehr Betrieb';
    } else if (dayOfWeek >= 1 && dayOfWeek <= 4) {
      dayHint = 'Wochentag \u2013 tendenziell ruhiger';
    } else {
      dayHint = 'Freitag \u2013 Anreisetag, zunehmender Betrieb';
    }

    return {
      level: level,
      label: label,
      color: color,
      ferienCount: ferienCount,
      activeNames: activeNames,
      dayOfWeek: dayNames[dayOfWeek],
      dayHint: dayHint,
      score: Math.round(score * 10) / 10
    };
  };

  // Translate avalanche problem types to German
  window.translateAvalancheProblem = function (type) {
    var map = {
      'new_snow': 'Neuschnee',
      'wind_slab': 'Triebschnee',
      'persistent_weak_layers': 'Altschneeproblem',
      'wet_snow': 'Nassschnee',
      'gliding_snow': 'Gleitschnee'
    };
    return map[type] || type;
  };

  // Avalanche level labels
  window.getAvalancheLabel = function (level) {
    var labels = { 1: 'Gering', 2: 'Mäßig', 3: 'Erheblich', 4: 'Groß', 5: 'Sehr groß' };
    return labels[level] || 'Unbekannt';
  };

})();
