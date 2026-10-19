/* =====================================================================
 * rules.js – helpers + business rules shared by all three views.
 *
 *   SBUtil  – escaping, time maths, labels
 *   SBRules – validation of assignment changes (errors / warnings)
 *   SBToast – top-right toast notifications (Views 1 and 3)
 *   SBNotice – centred pop-up for errors, warnings and confirmations (View 2)
 *
 * The rules mirror the production "StandBy > Update Schedule" screen.
 * ===================================================================== */

/* ---------------------------------------------------------------------
 * SBUtil – small shared helpers
 * ------------------------------------------------------------------- */
var SBUtil = (function () {
    'use strict';

    var DAY = 1440;   // minutes in a day
    var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

    /* Escape any value for safe insertion into HTML. */
    function esc(v) {
        return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; });
    }

    function isTime(t) { return typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t); }

    /* "HH:MM" -> minutes after midnight (NaN when invalid). */
    function toMin(t) {
        if (!isTime(t)) { return NaN; }
        return (+t.substr(0, 2)) * 60 + (+t.substr(3, 2));
    }

    /* minutes -> "HH:MM" (wraps around midnight; 1440 is shown as "24:00" when allow24). */
    function fmt(min, allow24) {
        if (allow24 && min === DAY) { return '24:00'; }
        min = ((Math.round(min) % DAY) + DAY) % DAY;
        var h = Math.floor(min / 60), m = min % 60;
        return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    }

    /* A shift as one or two [start, end) minute ranges inside 0..1440.
     * end <= start means the shift runs past midnight (22:00–06:00). */
    function segments(start, end) {
        var s = toMin(start), e = toMin(end);
        if (isNaN(s) || isNaN(e)) { return []; }
        if (e > s) { return [[s, e]]; }
        return [[s, DAY], [0, e]].filter(function (r) { return r[1] > r[0]; });
    }

    /* Do two shifts overlap? Handles shifts that cross midnight. */
    function overlaps(aStart, aEnd, bStart, bEnd) {
        var a = segments(aStart, aEnd), b = segments(bStart, bEnd);
        for (var i = 0; i < a.length; i++) {
            for (var j = 0; j < b.length; j++) {
                if (Math.max(a[i][0], b[j][0]) < Math.min(a[i][1], b[j][1])) { return true; }
            }
        }
        return false;
    }

    /* ---- Dates: plain "YYYY-MM-DD" strings, no time zone maths ---- */
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function isDate(d) { return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(dayNum(d)); }

    /* "YYYY-MM-DD" -> whole days since 1970-01-01 (NaN when invalid). */
    function dayNum(d) {
        var p = String(d || '').split('-');
        return p.length === 3 ? Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5) : NaN;
    }
    function fromDayNum(n) { return new Date(n * 864e5).toISOString().substr(0, 10); }
    function addDays(d, n) { return fromDayNum(dayNum(d) + n); }

    function today() {
        var t = new Date();
        return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
    }

    /* "Mon, 14 Oct" (withYear: "14 Oct 2026") */
    function fmtDate(d, withYear) {
        var dt = new Date(dayNum(d) * 864e5);
        if (withYear) { return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()] + ' ' + dt.getUTCFullYear(); }
        return DAYS[dt.getUTCDay()] + ', ' + dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()];
    }

    /* A dated shift as one [start, end) range in absolute minutes (end <= start runs past midnight). */
    function span(date, start, end) {
        var s = toMin(start), e = toMin(end);
        var a = dayNum(date) * DAY + s;
        return [a, a + (e > s ? e - s : e + DAY - s)];
    }

    /* Do two dated shifts overlap? Works across days and midnight. */
    function overlapsOn(aDate, aStart, aEnd, bDate, bStart, bEnd) {
        var a = span(aDate, aStart, aEnd), b = span(bDate, bStart, bEnd);
        return Math.max(a[0], b[0]) < Math.min(a[1], b[1]);
    }

    /* ---- Repeating shifts ----
     * A mapping repeats the same slot every day from shift_date to end_date (inclusive).
     * end_date empty (or not after shift_date) = a single day. */
    function endDate(m) { return m.end_date && dayNum(m.end_date) > dayNum(m.shift_date) ? m.end_date : m.shift_date; }
    function isSeries(m) { return endDate(m) !== m.shift_date; }
    function covers(m, d) { var n = dayNum(d); return n >= dayNum(m.shift_date) && n <= dayNum(endDate(m)); }

    /* First date (of a) on which two repeating shifts overlap, or null.
     * A shift is at most 24h long, so only same-day or neighbouring-day occurrences can meet. */
    function seriesOverlap(a, b) {
        var a0 = dayNum(a.shift_date), a1 = dayNum(endDate(a)), b0 = dayNum(b.shift_date), b1 = dayNum(endDate(b));
        for (var k = -1; k <= 1; k++) {            // b's occurrence is k days after a's
            var lo = Math.max(a0, b0 - k), hi = Math.min(a1, b1 - k);
            if (lo <= hi && overlapsOn(fromDayNum(lo), a.shift_start_time, a.shift_end_time,
                                       fromDayNum(lo + k), b.shift_start_time, b.shift_end_time)) { return fromDayNum(lo); }
        }
        return null;
    }

    /* Do the date ranges of two mappings share a day? */
    function datesIntersect(a, b) {
        return Math.max(dayNum(a.shift_date), dayNum(b.shift_date)) <= Math.min(dayNum(endDate(a)), dayNum(endDate(b)));
    }

    function timeRange(start, end) { return (start || '--:--') + ' - ' + (end || '--:--'); }

    /* "Tue, 14 Oct" or "Tue, 20 Oct – Sun, 25 Oct" */
    function datesLabel(date, end) {
        if (!isDate(date)) { return ''; }
        return fmtDate(date) + (isDate(end) && dayNum(end) > dayNum(date) ? ' – ' + fmtDate(end) : '');
    }

    /* "Tue, 14 Oct, 08:00 - 16:00" (with an end date: "Tue, 20 Oct – Sun, 25 Oct, 08:00 - 16:00") */
    function shiftLabel(date, start, end, endDay) { return (isDate(date) ? datesLabel(date, endDay) + ', ' : '') + timeRange(start, end); }
    function mappingLabel(m) { return shiftLabel(m.shift_date, m.shift_start_time, m.shift_end_time, m.end_date); }

    /* "Amit Sir Corporate / Powai" */
    function placeLabel(locationId) {
        var loc = SBData.location(locationId);
        if (!loc) { return '(no location)'; }
        var corp = SBData.corporate(loc.corporate_id);
        return (corp ? corp.corporatename : '?') + ' / ' + loc.location_title;
    }

    function initials(name) {
        var p = String(name || '').trim().split(/\s+/);
        return ((p[0] || '').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
    }

    /* Stable avatar colour for a name. */
    var COLORS = ['#2c9bae', '#6c0a10', '#26B99A', '#3498DB', '#9B59B6', '#E67E22', '#34495E', '#16A085', '#C0392B', '#7F8C8D'];
    function color(name) {
        var h = 0, s = String(name || '');
        for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) % 9973; }
        return COLORS[h % COLORS.length];
    }

    /* Day / Evening / Night bucket by shift start time (used by filters). */
    function bucket(start) {
        var s = toMin(start);
        if (s >= 360 && s < 840) { return 'day'; }       // 06:00 – 13:59
        if (s >= 840 && s < 1320) { return 'evening'; }  // 14:00 – 21:59
        return 'night';                                  // 22:00 – 05:59
    }

    /* Copy a mapping into the "change" shape used by SBRules / SBData. */
    function toChange(m) {
        return {
            mapping_id: m.id, driver_id: m.driver_id, location_id: m.location_id, shift_type: m.shift_type,
            shift_date: m.shift_date, end_date: m.end_date || null, shift_start_time: m.shift_start_time, shift_end_time: m.shift_end_time
        };
    }

    /* <option> list of locations grouped by corporate. */
    function locationOptions(selectedId, corporateId) {
        var html = '';
        SBData.corporates().forEach(function (c) {
            if (corporateId && c.id !== +corporateId) { return; }
            html += '<optgroup label="' + esc(c.corporatename) + '">';
            SBData.locations(c.id).forEach(function (l) {
                html += '<option value="' + l.id + '"' + (l.id === +selectedId ? ' selected' : '') + '>' + esc(l.location_title) + '</option>';
            });
            html += '</optgroup>';
        });
        return html;
    }

    return {
        DAY: DAY, esc: esc, isTime: isTime, toMin: toMin, fmt: fmt, segments: segments, overlaps: overlaps,
        isDate: isDate, dayNum: dayNum, addDays: addDays, today: today, fmtDate: fmtDate, span: span, overlapsOn: overlapsOn,
        endDate: endDate, isSeries: isSeries, covers: covers, seriesOverlap: seriesOverlap, datesIntersect: datesIntersect,
        datesLabel: datesLabel, mappingLabel: mappingLabel,
        timeRange: timeRange, shiftLabel: shiftLabel, placeLabel: placeLabel, initials: initials, color: color, bucket: bucket, toChange: toChange,
        locationOptions: locationOptions
    };
}());


/* ---------------------------------------------------------------------
 * SBRules – validation shared by all views
 *
 * validate(changes) -> [{ errors: [..], warnings: [..] }, ...] (same order)
 *   change = { mapping_id (null for a new assignment), driver_id, location_id, shift_date,
 *              end_date (optional: repeat daily up to this date), shift_type, shift_start_time, shift_end_time }
 *
 * ERRORS block the save, WARNINGS allow it after review.
 * ------------------------------------------------------------------- */
var SBRules = (function (U) {
    'use strict';

    function driverName(id) { var d = SBData.driver(id); return d ? d.full_name : 'Driver #' + id; }

    /* Shift date of a change: its own, else the mapping's current date, else today. */
    function dateOf(c) {
        var orig = c.mapping_id ? SBData.mapping(c.mapping_id) : null;
        return c.shift_date || (orig && orig.shift_date) || U.today();
    }

    /* End date of a change: its own when given, else the mapping's current one (null = single day). */
    function endOf(c) {
        if (c.end_date !== undefined) { return c.end_date || null; }
        var orig = c.mapping_id ? SBData.mapping(c.mapping_id) : null;
        return orig ? orig.end_date || null : null;
    }

    function validate(changes) {
        var batchIds = {};
        changes = changes.map(function (c) { return $.extend({}, c, { shift_date: dateOf(c), end_date: endOf(c) }); });
        changes.forEach(function (c) { if (c.mapping_id) { batchIds[c.mapping_id] = true; } });

        // Mappings NOT touched by this batch keep their current values.
        var untouched = SBData.mappings().filter(function (m) { return !batchIds[m.id]; });

        var results = changes.map(function () { return { errors: [], warnings: [] }; });

        /* ---- Errors ---- */
        changes.forEach(function (c, i) {
            var r = results[i];
            var startOk = U.isTime(c.shift_start_time), endOk = U.isTime(c.shift_end_time);

            if (!c.location_id || !SBData.location(c.location_id)) {
                r.errors.push('Select a destination location.');
            }
            if (!startOk) { r.errors.push('Start time is missing or invalid.'); }
            if (!endOk) { r.errors.push('End time is missing or invalid.'); }
            if (startOk && endOk && c.shift_start_time === c.shift_end_time) {
                r.errors.push('Start and end time cannot be the same.');
            }

            var orig = c.mapping_id ? SBData.mapping(c.mapping_id) : null;
            var datesOk = U.isDate(c.shift_date) && (!c.end_date || U.isDate(c.end_date));
            if (!datesOk) {
                r.errors.push('Shift date is missing or invalid.');
            } else {
                if (U.dayNum(c.shift_date) < U.dayNum(U.today()) && (!orig || orig.shift_date !== c.shift_date)) {
                    r.errors.push('Shifts cannot be moved to a past date (' + U.fmtDate(c.shift_date) + ').');
                }
                if (c.end_date && U.dayNum(c.end_date) < U.dayNum(c.shift_date)) {
                    r.errors.push('The To date cannot be before the From date.');
                }
            }

            if (orig && orig.location_id === +c.location_id && orig.shift_type === c.shift_type && orig.shift_date === c.shift_date &&
                    U.endDate(orig) === U.endDate(c) &&
                    orig.shift_start_time === c.shift_start_time && orig.shift_end_time === c.shift_end_time) {
                r.errors.push('Nothing changed – pick a different date, location, shift type or timing.');
            }

            if (c.location_id && datesOk) {
                untouched.forEach(function (m) {
                    if (m.driver_id === +c.driver_id && m.location_id === +c.location_id && U.datesIntersect(m, c)) {
                        r.errors.push('Driver is already assigned to ' + U.placeLabel(m.location_id) + ' (' + U.mappingLabel(m) + ').');
                    }
                });
                for (var j = 0; j < changes.length; j++) {
                    if (j !== i && +changes[j].driver_id === +c.driver_id && +changes[j].location_id === +c.location_id &&
                            U.isDate(changes[j].shift_date) && U.datesIntersect(changes[j], c)) {
                        r.errors.push('This driver is moved to ' + U.placeLabel(c.location_id) + ' twice in this batch.');
                        break;
                    }
                }
            }
        });

        /* ---- Warnings (only for rows without errors) ---- */
        // Projected state = untouched mappings + the batch rows as they will be saved.
        var projected = untouched.map(function (m) { return $.extend({ batchIndex: -1 }, m); });
        changes.forEach(function (c, i) {
            if (!results[i].errors.length) {
                projected.push($.extend({ batchIndex: i }, c, { driver_id: +c.driver_id, location_id: +c.location_id }));
            }
        });

        changes.forEach(function (c, i) {
            var r = results[i];
            if (r.errors.length) { return; }

            projected.forEach(function (p) {
                if (p.batchIndex === i) { return; }
                var on = U.seriesOverlap(c, p);
                if (!on) { return; }
                var when = U.isSeries(c) ? ' on ' + U.fmtDate(on) : '';

                // 1. Overlaps another shift of the same driver (any date, any location).
                if (p.driver_id === +c.driver_id) {
                    r.warnings.push("Overlaps with the driver's shift at " + U.placeLabel(p.location_id) +
                        ' (' + U.mappingLabel(p) + ')' + when + '.');
                }

                if (c.shift_type !== 'Permanent' || p.location_id !== +c.location_id || p.shift_type !== 'Permanent' ||
                        p.driver_id === +c.driver_id) { return; }

                // 2. Destination already has an overlapping Permanent driver
                //    (drivers moving out in this batch are not in "untouched", so they don't count).
                if (p.batchIndex === -1) {
                    r.warnings.push(U.placeLabel(c.location_id) + ' already has a Permanent driver in this time: ' +
                        driverName(p.driver_id) + ' (' + U.mappingLabel(p) + ')' + when + '.');
                } else {
                // 3. Two drivers in this batch both Permanent, overlapping, at the same location.
                    r.warnings.push('Both this driver and ' + driverName(p.driver_id) + ' are set to Permanent at ' +
                        U.placeLabel(c.location_id) + ' with overlapping shifts.');
                }
            });
        });

        return results;
    }

    /* Warnings for mapping m against the current data. With `date`, only m's shift on that day counts. */
    function warningsFor(m, all, date) {
        var a = date ? $.extend({}, m, { shift_date: date, end_date: null }) : m, w = [];
        all.forEach(function (o) {
            if (o.id === m.id) { return; }
            var on = U.seriesOverlap(a, o);
            if (!on) { return; }
            var when = U.isSeries(a) ? ' on ' + U.fmtDate(on) : '';
            if (o.driver_id === m.driver_id) {
                w.push("Overlaps with the driver's shift at " + U.placeLabel(o.location_id) + ' (' + U.mappingLabel(o) + ')' + when + '.');
            } else if (o.location_id === m.location_id && m.shift_type === 'Permanent' && o.shift_type === 'Permanent') {
                w.push('Another Permanent driver overlaps at this location: ' + driverName(o.driver_id) +
                    ' (' + U.mappingLabel(o) + ')' + when + '.');
            }
        });
        return w;
    }

    /* Warnings for the CURRENT data (used to flag existing blocks/cards). */
    function currentWarnings() {
        var all = SBData.mappings(), out = {};
        all.forEach(function (m) {
            var w = warningsFor(m, all);
            if (w.length) { out[m.id] = w; }
        });
        return out;
    }

    /* Warnings for one day of a (possibly repeating) shift – View 2 flags each day on its own. */
    function dayWarnings(m, date) { return warningsFor(m, SBData.mappings(), date); }

    /* Plain-English description of one change (used for toasts + "Recent changes").
     * `orig` overrides the mapping it is compared with (e.g. one day of a repeating shift). */
    function describe(c, orig) {
        var name = driverName(c.driver_id);
        orig = orig || (c.mapping_id ? SBData.mapping(c.mapping_id) : null);
        var newTime = U.timeRange(c.shift_start_time, c.shift_end_time), date = dateOf(c), end = endOf(c);
        if (!orig) {
            return 'Assigned ' + name + ' to ' + U.placeLabel(c.location_id) + ' (' + c.shift_type + ', ' +
                U.shiftLabel(date, c.shift_start_time, c.shift_end_time, end) + ')';
        }
        var parts = [];
        if (orig.location_id !== +c.location_id) {
            parts.push('moved ' + U.placeLabel(orig.location_id) + ' → ' + U.placeLabel(c.location_id));
        }
        if (orig.shift_date !== date || U.endDate(orig) !== U.endDate({ shift_date: date, end_date: end })) {
            parts.push(U.datesLabel(orig.shift_date, orig.end_date) + ' → ' + U.datesLabel(date, end));
        }
        if (orig.shift_type !== c.shift_type) { parts.push(orig.shift_type + ' → ' + c.shift_type); }
        if (orig.shift_start_time !== c.shift_start_time || orig.shift_end_time !== c.shift_end_time) {
            parts.push(U.timeRange(orig.shift_start_time, orig.shift_end_time) + ' → ' + newTime);
        }
        return name + ': ' + (parts.join(', ') || 'no change');
    }

    /* Label for a batch of changes. */
    function describeBatch(changes) {
        if (changes.length === 1) { return describe(changes[0]); }
        var names = changes.map(function (c) { return driverName(c.driver_id); });
        return 'Updated ' + changes.length + ' assignments (' + names.join(', ') + ')';
    }

    /* <ul> of messages for inline display. */
    function messagesHtml(res) {
        var html = '';
        res.errors.forEach(function (m) { html += '<li class="sb-msg-error"><i class="fa fa-times-circle"></i> ' + U.esc(m) + '</li>'; });
        res.warnings.forEach(function (m) { html += '<li class="sb-msg-warning"><i class="fa fa-exclamation-triangle"></i> ' + U.esc(m) + '</li>'; });
        return html ? '<ul class="sb-msgs">' + html + '</ul>' : '';
    }

    return {
        validate: validate, currentWarnings: currentWarnings, dayWarnings: dayWarnings, describe: describe,
        describeBatch: describeBatch, messagesHtml: messagesHtml, driverName: driverName
    };
}(SBUtil));


/* ---------------------------------------------------------------------
 * SBToast – SBToast.show('Saved', 'success' | 'error' | 'warning' | 'info')
 * ------------------------------------------------------------------- */
var SBToast = (function ($, U) {
    'use strict';
    var ICONS = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };

    function show(message, type, title) {
        type = ICONS[type] ? type : 'info';
        var $box = $('#sb-toasts');
        if (!$box.length) { $box = $('<div id="sb-toasts" aria-live="polite"></div>').appendTo('body'); }
        var $t = $('<div class="sb-toast sb-toast-' + type + '" role="status">' +
            '<i class="fa ' + ICONS[type] + '"></i>' +
            '<div class="sb-toast-text">' + (title ? '<strong>' + U.esc(title) + '</strong>' : '') + U.esc(message) + '</div>' +
            '<button type="button" class="sb-toast-close" aria-label="Close">&times;</button></div>');
        $box.prepend($t);
        $box.children('.sb-toast').slice(3).remove();   // keep at most 3 on screen
        setTimeout(function () { $t.addClass('in'); }, 10);
        var close = function () { $t.removeClass('in'); setTimeout(function () { $t.remove(); }, 250); };
        $t.find('.sb-toast-close').on('click', close);
        setTimeout(close, type === 'error' || type === 'warning' ? 6000 : 3500);
    }

    return { show: show };
}(jQuery, SBUtil));


/* ---------------------------------------------------------------------
 * SBNotice – centred pop-up for important messages (errors, warnings, confirmations).
 *
 *   SBNotice.show({
 *       type:    'error' | 'warning' | 'info' | 'success' | 'confirm',
 *       title:   'Not saved',
 *       message: 'One line …'  or  messages: ['several', 'lines'],   (plain text, escaped here)
 *       reason:  'Why it matters / what to do next',                  (optional, shown highlighted)
 *       buttons: [{ label: 'Save anyway', value: 'yes', primary: true }, { label: 'Cancel', value: '' }]
 *   }, function (value) { … });   // value of the clicked button; '' on Esc / backdrop / ×
 *
 * Without buttons a single "Close" button is shown. Key words (driver and location names,
 * dates, times, "Permanent", "past date", "overlaps", …) are highlighted automatically.
 * ------------------------------------------------------------------- */
var SBNotice = (function ($, U) {
    'use strict';
    var ICONS = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle', confirm: 'fa-question-circle' };
    var KEYWORDS = ['past date', 'not allowed', 'cannot', 'already assigned', 'already has a Permanent driver', 'Overlaps', 'overlaps', 'overlapping', 'Conflict',
        'Permanent', 'Reliever', 'twice', 'Nothing changed', 'missing or invalid', 'runs past midnight', 'all days', 'only this day'];
    var open = null;   // { $el, cb, lastFocus }

    function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

    /* Escape a message, then wrap important parts in <mark>/<b>. Longest names first so
     * "Amit Sir Corporate / Powai" wins over "Powai". */
    function highlight(text) {
        var names = [];
        SBData.drivers().forEach(function (d) { names.push(d.full_name); });
        SBData.locations().forEach(function (l) {
            names.push(l.location_title);
            var c = SBData.corporate(l.corporate_id);
            if (c) { names.push(c.corporatename + ' / ' + l.location_title); }
        });
        names = names.filter(Boolean).sort(function (a, b) { return b.length - a.length; }).map(function (n) { return U.esc(n); });

        var rules = [
            { cls: 'sb-n-kw', words: KEYWORDS.map(reEsc) },
            { cls: 'sb-n-name', words: names.map(reEsc) }
        ];
        var date = '(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat), \\d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
        var time = '\\d{2}:\\d{2}(?: ?[-–] ?\\d{2}:\\d{2})?';
        // an empty group would match everywhere, so a rule without words gets a never-matching one
        var parts = rules.map(function (r) { return '(' + (r.words.length ? r.words.join('|') : '(?!)') + ')'; });
        parts.push('(' + date + '(?: – ' + date + ')?)', '(' + time + ')');
        var re = new RegExp(parts.join('|'), 'g');

        return U.esc(text).replace(re, function (all, kw, name, d, t) {
            if (kw) { return '<mark class="sb-n-kw">' + all + '</mark>'; }
            if (name) { return '<b class="sb-n-name">' + all + '</b>'; }
            return '<span class="sb-n-when">' + all + '</span>';
        });
    }

    function close(value) {
        if (!open) { return; }
        var o = open;
        open = null;
        $(document).off('keydown.sbnotice');
        o.$el.removeClass('in');
        setTimeout(function () { o.$el.remove(); }, 180);
        if (o.lastFocus && o.lastFocus.focus) { try { o.lastFocus.focus(); } catch (e) { /* ignore */ } }
        if (o.cb) { o.cb(value); }
    }

    function show(opts, cb) {
        if (open) { close(''); }
        var type = ICONS[opts.type] ? opts.type : 'info';
        var msgs = opts.messages || (opts.message ? [opts.message] : []);
        var buttons = opts.buttons && opts.buttons.length ? opts.buttons : [{ label: 'Close', value: 'close', primary: true }];

        var body = msgs.length > 1
            ? '<ul class="sb-n-list">' + msgs.map(function (m) { return '<li>' + highlight(m) + '</li>'; }).join('') + '</ul>'
            : '<p class="sb-n-msg">' + highlight(msgs[0] || '') + '</p>';
        var btnHtml = buttons.map(function (b, i) {
            var cls = b.primary ? (type === 'error' || b.danger ? 'btn-danger' : 'btn-primary') : (b.link ? 'btn-link' : 'btn-default');
            return '<button type="button" class="btn btn-sm ' + cls + '" data-i="' + i + '">' +
                (b.icon ? '<i class="fa ' + b.icon + '"></i> ' : '') + U.esc(b.label) + '</button>';
        }).join('');

        var $el = $('<div class="sb-notice sb-notice-' + type + '">' +
            '<div class="sb-notice-box" role="' + (type === 'error' || type === 'warning' ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="sb-notice-title">' +
                '<button type="button" class="sb-notice-x" aria-label="Close">&times;</button>' +
                '<div class="sb-notice-icon"><i class="fa ' + ICONS[type] + '"></i></div>' +
                '<h4 id="sb-notice-title">' + U.esc(opts.title || '') + '</h4>' +
                body +
                (opts.reason ? '<div class="sb-n-reason"><i class="fa fa-lightbulb-o"></i> ' + highlight(opts.reason) + '</div>' : '') +
                '<div class="sb-notice-foot">' + btnHtml + '</div>' +
            '</div></div>').appendTo('body');

        open = { $el: $el, cb: cb, lastFocus: document.activeElement };
        setTimeout(function () { $el.addClass('in'); }, 10);
        var $primary = $el.find('.sb-notice-foot .btn-primary, .sb-notice-foot .btn-danger').first();
        ($primary.length ? $primary : $el.find('.sb-notice-foot .btn').first()).trigger('focus');

        $el.on('click', '.sb-notice-foot .btn', function () { close(buttons[+$(this).data('i')].value); });
        $el.on('click', '.sb-notice-x', function () { close(''); });
        $el.on('click', function (e) { if (e.target === $el[0]) { close(''); } });
        $(document).on('keydown.sbnotice', function (e) {
            if (e.key === 'Escape') { e.stopImmediatePropagation(); close(''); return; }
            if (e.key === 'Tab') {   // keep focus inside the dialog
                var $f = $el.find('button'), first = $f[0], last = $f[$f.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
    }

    return { show: show, close: close, isOpen: function () { return !!open; } };
}(jQuery, SBUtil));
