(function () {
  'use strict';

  // Obfuscated API base URLs
  function _m() { return atob('aHR0cHM6Ly9hcGkub3Blbi1tZXRlby5jb20vdjEvZm9yZWNhc3Q='); }
  function _e() { return atob('aHR0cHM6Ly9zdGF0aWMuYXZhbGFuY2hlLnJlcG9ydC9lYXdzX2J1bGxldGlucw=='); }
  function _s() { return atob('aHR0cHM6Ly9hd3Muc2xmLmNoL2FwaS9idWxsZXRpbi9jYWFtbC9kZS9qc29u'); }
  function _h() { return atob('aHR0cHM6Ly9vcGVuaG9saWRheXNhcGkub3Jn'); }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function weekFromNow() {
    var d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  /**
   * Open-Meteo: snow depth, snowfall, temperature
   */
  window.fetchSnowData = async function (lat, lon) {
    try {
      var url = _m() + '?latitude=' + lat + '&longitude=' + lon +
        '&hourly=snow_depth,snowfall&daily=snowfall_sum,temperature_2m_max,temperature_2m_min' +
        '&timezone=Europe/Berlin&forecast_days=7';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();

      // snow_depth in meters -> cm
      var hourly = data.hourly || {};
      var daily = data.daily || {};
      var depths = hourly.snow_depth || [];
      var currentDepthM = depths[0] || 0;
      var currentDepthCm = Math.round(currentDepthM * 100);

      // Snow depth at ~72h (3 days)
      var depth3d = depths.length > 72 ? depths[72] : depths[depths.length - 1] || 0;
      var depth3dCm = Math.round(depth3d * 100);

      // Snow depth at end (7d)
      var depth7d = depths.length > 0 ? depths[depths.length - 1] : 0;
      var depth7dCm = Math.round(depth7d * 100);

      // Snowfall sum per day (cm)
      var snowfallDaily = daily.snowfall_sum || [];

      // Neuschnee 3 Tage
      var newSnow3d = 0;
      for (var i = 0; i < Math.min(3, snowfallDaily.length); i++) {
        newSnow3d += snowfallDaily[i] || 0;
      }
      newSnow3d = Math.round(newSnow3d * 10) / 10;

      // Avg temp 3 days
      var maxTemps = daily.temperature_2m_max || [];
      var minTemps = daily.temperature_2m_min || [];
      var tempSum = 0;
      var tempCount = 0;
      for (var j = 0; j < Math.min(3, maxTemps.length); j++) {
        tempSum += ((maxTemps[j] || 0) + (minTemps[j] || 0)) / 2;
        tempCount++;
      }
      var avgTemp3d = tempCount > 0 ? Math.round((tempSum / tempCount) * 10) / 10 : 0;

      // Trend (difference in snow depth over 3 days)
      var trend = depth3dCm - currentDepthCm;

      return {
        currentDepth: currentDepthCm,
        depth3d: depth3dCm,
        depth7d: depth7dCm,
        newSnow3d: newSnow3d,
        snowfallDaily: snowfallDaily.map(function (v) { return Math.round((v || 0) * 10) / 10; }),
        avgTemp3d: avgTemp3d,
        trend: trend,
        maxTemps: maxTemps,
        minTemps: minTemps,
        dailyDates: daily.time || []
      };
    } catch (e) {
      console.warn('Snow data error:', e);
      return null;
    }
  };

  /**
   * EAWS Avalanche ratings (AT, DE)
   */
  window.fetchAvalancheEAWS = async function (region, microRegion) {
    try {
      var date = todayStr();
      var url = _e() + '/' + date + '/' + date + '-' + region + '.ratings.json';
      var res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var ratings = data.maxDangerRatings || {};

      // Try exact micro-region first
      if (microRegion && ratings[microRegion] !== undefined) {
        return { level: ratings[microRegion], source: 'eaws' };
      }

      // Fallback: find highest for parent region
      var maxLevel = 0;
      var prefix = microRegion ? microRegion.split('-').slice(0, -1).join('-') : region;
      for (var key in ratings) {
        if (key.indexOf(prefix) === 0 && !key.includes(':')) {
          if (ratings[key] > maxLevel) maxLevel = ratings[key];
        }
      }

      if (maxLevel > 0) return { level: maxLevel, source: 'eaws' };

      // Last fallback: any key without suffix
      for (var k in ratings) {
        if (!k.includes(':') && ratings[k] > maxLevel) maxLevel = ratings[k];
      }

      return { level: maxLevel || 0, source: 'eaws' };
    } catch (e) {
      console.warn('EAWS error:', e);
      return null;
    }
  };

  /**
   * SLF Swiss avalanche (CH)
   */
  window.fetchAvalancheSLF = async function (microRegion) {
    try {
      var res = await fetch(_s());
      if (!res.ok) throw new Error(res.status);
      var data = await res.json();
      var bulletins = data.bulletins || [];

      var levelMap = {
        'low': 1, 'moderate': 2, 'considerable': 3, 'high': 4, 'very_high': 5
      };

      for (var i = 0; i < bulletins.length; i++) {
        var b = bulletins[i];
        var regions = b.regions || [];
        var found = false;
        for (var j = 0; j < regions.length; j++) {
          if (regions[j].regionID === microRegion) { found = true; break; }
        }
        if (found && b.dangerRatings && b.dangerRatings.length > 0) {
          var mainVal = b.dangerRatings[0].mainValue || 'low';
          var problems = (b.avalancheProblems || []).map(function (p) { return p.problemType; });
          return {
            level: levelMap[mainVal] || 0,
            source: 'slf',
            problems: problems
          };
        }
      }

      return null;
    } catch (e) {
      console.warn('SLF error:', e);
      return null;
    }
  };

  /**
   * Combined avalanche fetch
   */
  window.fetchAvalancheRating = async function (region, microRegion, country) {
    if (country === 'CH') {
      return await window.fetchAvalancheSLF(microRegion);
    }
    return await window.fetchAvalancheEAWS(region, microRegion);
  };

  /**
   * OpenHolidays: fetch school holidays for all 5 countries
   */
  window.fetchHolidays = async function () {
    try {
      var countries = ['AT', 'DE', 'CH', 'NL', 'BE'];
      var from = todayStr();
      var to = weekFromNow();
      var all = [];

      var promises = countries.map(function (cc) {
        var url = _h() + '/SchoolHolidays?countryIsoCode=' + cc +
          '&validFrom=' + from + '&validTo=' + to + '&languageIsoCode=DE';
        return fetch(url).then(function (r) {
          if (!r.ok) return [];
          return r.json();
        }).then(function (arr) {
          return (Array.isArray(arr) ? arr : []).map(function (h) {
            h.countryIsoCode = cc;
            return h;
          });
        }).catch(function () { return []; });
      });

      var results = await Promise.all(promises);
      for (var i = 0; i < results.length; i++) {
        all = all.concat(results[i]);
      }

      return all;
    } catch (e) {
      console.warn('Holidays error:', e);
      return [];
    }
  };

  /**
   * Fetch all data for a single resort
   */
  window.fetchAllResortData = async function (resort) {
    var results = await Promise.all([
      window.fetchSnowData(resort.lat, resort.lon),
      window.fetchAvalancheRating(resort.avalancheRegion, resort.avalancheMicroRegion, resort.country),
      window.fetchHolidays()
    ]);

    return {
      snow: results[0],
      avalanche: results[1],
      holidays: results[2]
    };
  };

})();
