/* =====================================================================
 * view2.js – VIEW 2 "Calendar"
 * Week view: one location, its 7 dates as columns. Day view: one date, every location as a column.
 * Tabs above the grid switch location / date and accept dropped shifts. Y-axis = 00:00–24:00.
 * Drag a block to move it (date, time and/or location), drag its edges to shift an 8-hour slot,
 * click it to edit, click an empty slot to assign a driver.
 * Uses pointer events, so it works with mouse and touch (no libraries).
 * ===================================================================== */
var SBView2 = (function ($, U, R) {
    'use strict';

    var SLOT_PX = { 30: 26, 60: 44, 240: 120 };   // pixel height of one slot per zoom level (30 min, 1 hr, 4 hr)
    var SNAP = 15;                      // drag/resize snap in minutes
    var SHIFT_LEN = 8 * 60;             // edge drag keeps shifts this long; also the drawer's default end time
    var NUM_DAYS = 7;                   // days shown on the x-axis
    var COL_W = { legend: 130, names: 190 };   // minimum column width per header mode
    var colMode = 'legend';              // day view headers: 'legend' = letter badges + legend, 'names' = full location names

    /* Two layouts keep the grid narrow with any number of locations:
     *   'week' – one location, its 7 dates as columns; location tabs above (click / drop a shift to move it there)
     *   'day'  – one date, every location as a column; date tabs above (click / drop a shift to move it there) */
    var viewMode = 'week';
    var focusLoc = null;                // location shown in week view
    var focusDate = U.today();          // date shown in day view (always inside the visible week)

    /* The 7 visible days start on Monday ('monday', default) or on the chosen day ('today').
     * The choice is remembered per browser. */
    var WEEK_KEY = 'standbyDemo.v2WeekStart';
    var weekMode = (function () { try { return localStorage.getItem(WEEK_KEY) === 'today' ? 'today' : 'monday'; } catch (e) { return 'monday'; } }());

    /* Monday of the week containing `date` (dayNum 0 = 1970-01-01 was a Thursday). */
    function mondayOf(date) { return U.addDays(date, -((U.dayNum(date) % 7 + 10) % 7)); }
    /* First visible date for a week that should contain `date`. */
    function startFor(date) { return weekMode === 'monday' ? mondayOf(date) : date; }

    var corpId = 1;
    var weekStart = startFor(U.today());   // first visible date
    var zoom = 30;
    var $scroller;
    var drag = null;                    // active block drag/resize
    var chipDrag = null;                // active "unassigned driver" chip drag
    var scopeAsk = false;               // waiting for "only this day / all days" after a drag
    var suppressClickUntil = 0;
    var scrollToMin = 7 * 60;           // initial scroll position (07:00)
    var drawer = { open: false, mode: 'edit', mappingId: null, series: false, occ: null };

    function ppm() { return SLOT_PX[zoom] / zoom; }   // pixels per minute
    function snap(min) { return Math.round(min / SNAP) * SNAP; }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    /* ---------- toolbar ---------- */
    function fillToolbar() {
        var html = '';
        SBData.corporates().forEach(function (c) {
            html += '<option value="' + c.id + '">' + U.esc(c.corporatename) + '</option>';
        });
        $('#v2-corp').html(html).val(corpId);
        var corp = SBData.corporate(corpId);
        $('#v2-company').val(corp ? corp.companyname : '');
    }

    /* ---------- dates ---------- */
    function visibleDays() {
        var out = [];
        for (var i = 0; i < NUM_DAYS; i++) { out.push(U.addDays(weekStart, i)); }
        return out;
    }

    function isVisible(date) {
        var d = U.dayNum(date) - U.dayNum(weekStart);
        return d >= 0 && d < NUM_DAYS;
    }

    /* "14 Oct – 20 Oct 2026" (the year is repeated only when it changes) */
    function rangeLabel() {
        var a = U.fmtDate(weekStart, true), b = U.fmtDate(U.addDays(weekStart, NUM_DAYS - 1), true);
        if (a.slice(-4) === b.slice(-4)) { a = a.slice(0, -5); }
        return a + ' – ' + b;
    }

    /* Date + minutes from that date's midnight (may be < 0 or >= 1440) -> { date, time } */
    function fromAbs(date, min) {
        var days = Math.floor(min / U.DAY);
        return { date: U.addDays(date, days), time: U.fmt(min - days * U.DAY) };
    }

    /* ---------- block layout: overlapping blocks sit side by side ----------
     * A column is one location on one date. A repeating shift shows on every date of
     * its From–To range (each day is an "occurrence", `occ` = the day it starts).
     * A shift that runs past midnight shows its first part on its own date and its
     * second part at the top of the next date. */
    function layoutColumn(locationId, date) {
        var items = [], prev = U.addDays(date, -1);
        SBData.mappingsAt(locationId).forEach(function (m) {
            var segs = U.segments(m.shift_start_time, m.shift_end_time), split = segs.length > 1;
            if (U.covers(m, date) && segs.length) {
                items.push({ m: m, occ: date, s: segs[0][0], e: segs[0][1], part: split ? 'first' : 'only' });
            }
            if (U.covers(m, prev) && split) {
                items.push({ m: m, occ: prev, s: segs[1][0], e: segs[1][1], part: 'second' });
            }
        });
        items.sort(function (a, b) { return a.s - b.s || b.e - a.e; });

        var cluster = [], lanes = [], clusterEnd = -1;
        function close() { cluster.forEach(function (it) { it.lanes = lanes.length; }); cluster = []; lanes = []; }
        items.forEach(function (it) {
            if (it.s >= clusterEnd) { close(); }
            var lane = 0;
            while (lane < lanes.length && lanes[lane] > it.s) { lane++; }
            lanes[lane] = it.e;
            it.lane = lane;
            cluster.push(it);
            clusterEnd = Math.max(clusterEnd, it.e);
        });
        close();
        return items;
    }

    /* Stable colours per driver: hues spread by the golden angle, so drivers next to each other differ clearly. */
    function driverColors(id) {
        var h = Math.round((id * 137.508) % 360);
        return {
            bg: 'hsl(' + h + ',70%,90%)',       // slot background (light, dark text stays readable)
            border: 'hsl(' + h + ',45%,72%)',
            avatar: 'hsl(' + h + ',50%,40%)'    // initials circle
        };
    }

    function blockHtml(it) {
        var m = it.m, d = SBData.driver(m.driver_id), series = U.isSeries(m);
        var w = R.dayWarnings(m, it.occ);   // conflicts are flagged per day
        w = w.length ? w : null;
        var p = ppm(), top = it.s * p, h = Math.max((it.e - it.s) * p, 16) - 1;
        var width = 100 / it.lanes, left = it.lane * width;
        var range = m.shift_start_time + '–' + m.shift_end_time;
        var timeTxt = it.part === 'first' ? U.esc(range) + ' <span class="b-cont">↪</span>' :
                      it.part === 'second' ? '<span class="b-cont">↪</span> ' + U.esc(range) : U.esc(range);
        var tip = d.full_name + ' (' + d.mobile_no + ')\n' + m.shift_type + ', ' + U.shiftLabel(it.occ, m.shift_start_time, m.shift_end_time) +
                  (it.part !== 'only' ? ' – runs past midnight' : '') +
                  (series ? '\nRepeats daily: ' + U.datesLabel(m.shift_date, m.end_date) : '') +
                  (w ? '\n\n⚠ ' + w.join('\n⚠ ') : '') +
                  '\n\nDrag to move · drag an edge to set an 8h slot · click to edit';
        var dc = driverColors(d.id);
        // Colour = the driver (same on all their slots); left strip = shift type (teal Permanent / amber Reliever)
        return '<div class="v2-block ' + (m.shift_type === 'Permanent' ? 'perm' : 'rel') + (w ? ' warn' : '') + (it.lanes > 1 ? ' narrow' : '') + '"' +
            ' data-id="' + m.id + '" data-occ="' + it.occ + '" data-part="' + it.part + '" title="' + U.esc(tip) + '"' +
            ' style="top:' + top + 'px;height:' + h + 'px;left:calc(' + left + '% + 2px);width:calc(' + width + '% - 4px);' +
                'background:' + dc.bg + ';border-color:' + dc.border + '">' +
            (it.part !== 'second' ? '<div class="v2-h-top"></div>' : '') +
            (it.part !== 'first' ? '<div class="v2-h-bot"></div>' : '') +
            (w ? '<span class="b-warn"><i class="fa fa-exclamation"></i></span>' : '') +
            '<div class="b-who"><span class="b-ava" style="background:' + dc.avatar + '">' + U.esc(U.initials(d.full_name)) + '</span>' +
                '<span class="b-name">' + (series ? '<i class="fa fa-repeat b-rep" title="Repeats daily"></i> ' : '') + U.esc(d.full_name) + '</span></div>' +
            '<div class="b-meta">' + timeTxt + '</div>' +
            '<div class="b-meta b-phone">' + U.esc(d.mobile_no) + '</div>' +
            '</div>';
    }

    /* ---------- location legend: each location of the corporate gets a letter + colour ---------- */
    var LOC_COLORS = ['#3498DB', '#9B59B6', '#34495E', '#E67E22', '#16A085', '#C0392B', '#7F8C8D', '#2C3E50', '#AD1457', '#6D4C41'];
    function locMark(i) {
        return { code: String.fromCharCode(65 + (i % 26)), color: LOC_COLORS[i % LOC_COLORS.length] };
    }

    function renderLocLegend(locs) {
        $('#v2-loc-legend').html(locs.map(function (l, i) {
            var lm = locMark(i);
            return '<span title="' + U.esc(l.address1 + ', ' + l.address2) + '">' +
                '<i class="v2-loc-badge" style="background:' + lm.color + '">' + lm.code + '</i>' + U.esc(l.location_title) + '</span>';
        }).join(''));
    }

    /* ---------- grid ---------- */
    function render() {
        if (drag || chipDrag || scopeAsk) { return; }   // never rebuild under the user's finger
        fillToolbar();
        $('#v2-range').text(rangeLabel());
        $('#v2 [data-weekstart]').each(function () {
            var on = $(this).data('weekstart') === weekMode;
            $(this).toggleClass('active', on).attr('aria-pressed', on ? 'true' : 'false');
        });
        $('#v2-jump').val(weekStart);
        var el = $scroller[0];
        var keepTop = el.scrollTop, keepLeft = el.scrollLeft;
        var allLocs = SBData.locations(corpId);
        if (!allLocs.some(function (l) { return l.id === focusLoc; })) { focusLoc = allLocs.length ? allLocs[0].id : null; }
        if (!isVisible(focusDate)) { focusDate = weekStart; }

        var week = viewMode === 'week';
        var hdrMode = week ? 'legend' : colMode;   // the Legend / Location names choice applies to day view
        var days = week ? visibleDays() : [focusDate];
        var locs = week ? allLocs.filter(function (l) { return l.id === focusLoc; }) : allLocs;

        $('#v2 [data-viewmode]').each(function () {
            var on = $(this).data('viewmode') === viewMode;
            $(this).toggleClass('active', on).attr('aria-pressed', on ? 'true' : 'false');
        });
        $('#v2 .v2-colmode').toggle(!week);
        renderLocLegend(allLocs);
        $('#v2-loc-legend').toggle(!week && colMode === 'legend');
        renderStrip(allLocs);

        if (!allLocs.length) {
            $scroller.html('<div class="v2-empty"><i class="fa fa-map-marker fa-2x"></i><br>This corporate has no locations yet.</div>');
            renderUnassigned();
            return;
        }

        var p = ppm(), height = 1440 * p, todayNum = U.dayNum(U.today());
        var head = '<div class="v2-head"><div class="v2-corner">Time</div>';
        var cols = '';
        days.forEach(function (date) {
            var n = U.dayNum(date), isToday = n === todayNum;
            var cls = (isToday ? ' today' : '') + (n < todayNum ? ' past' : '');
            var grow = ' style="flex-grow:' + locs.length + '"';   // header and body day groups share the same width
            head += '<div class="v2-dayhead-group' + cls + '" data-date="' + date + '"' + grow + '>' +
                '<div class="v2-dayhead' + (week ? ' v2-drill" title="Open this day for all locations' : '') + '">' +
                    '<span class="v2-dayhead-label">' + U.esc(U.fmtDate(date)) +
                    (isToday ? ' <span class="v2-today-tag">Today</span>' : '') + '</span></div>' +
                '<div class="v2-colheads">';
            cols += '<div class="v2-day' + cls + '" data-date="' + date + '"' + grow + '>';
            locs.forEach(function (l) {
                var items = layoutColumn(l.id, date), drivers = {};
                items.forEach(function (it) { drivers[it.m.driver_id] = true; });
                var count = Object.keys(drivers).length, lm = locMark(allLocs.indexOf(l));
                var countHtml = '<span class="v2-count"' + (count ? '' : ' style="color:#E74C3C"') + '><i class="fa fa-user"></i> ';
                var drill = week ? '' : ' v2-drill';   // day view: click a location header to open its week
                var drillTip = week ? '' : '\nClick to see this location\'s week';
                if (hdrMode === 'names') {
                    // full header: location name + address + driver count
                    head += '<div class="v2-colhead names' + drill + '" data-loc="' + l.id + '" data-date="' + date + '"' +
                        ' title="' + U.esc(l.location_title + '\n' + l.address1 + ', ' + l.address2 + drillTip) + '">' +
                        '<strong>' + U.esc(l.location_title) + '</strong>' +
                        '<span class="sb-muted">' + U.esc(l.address1) + '</span>' +
                        countHtml + (count ? count + ' driver' + (count > 1 ? 's' : '') : 'No driver') + '</span></div>';
                } else {
                    // compact header: location badge (see the location legend / tabs) + driver count; full name on hover
                    head += '<div class="v2-colhead' + drill + '" data-loc="' + l.id + '" data-date="' + date + '" style="border-top-color:' + lm.color + '"' +
                        ' title="' + U.esc(lm.code + ' = ' + l.location_title + '\n' + l.address1 + ', ' + l.address2 + drillTip) + '">' +
                        '<span class="v2-loc-badge" style="background:' + lm.color + '">' + lm.code + '</span>' +
                        countHtml + count + '</span></div>';
                }
                cols += '<div class="v2-col" data-loc="' + l.id + '" data-date="' + date + '" style="height:' + height + 'px;' +
                    'background-image:linear-gradient(to bottom,#dfe3e7 1px,transparent 1px),linear-gradient(to bottom,#f1f3f5 1px,transparent 1px);' +
                    'background-size:100% ' + (60 * p) + 'px,100% ' + (zoom * p) + 'px">' +
                    '<div class="v2-slot-hint"></div>' +
                    items.map(blockHtml).join('') +
                    '</div>';
            });
            head += '</div></div>';
            cols += '</div>';
        });
        head += '</div>';

        var times = '';
        for (var t = 0; t <= 1440; t += zoom) {
            var style = 'top:' + (t * p) + 'px' + (t === 0 ? ';transform:none' : '') + (t === 1440 ? ';transform:translateY(-14px)' : '');
            times += '<div class="v2-time' + (t % 60 === 0 ? ' hour' : '') + '" style="' + style + '">' + U.fmt(t, true) + '</div>';
        }

        $scroller.toggleClass('names', hdrMode === 'names');
        $scroller.html('<div class="v2-grid" style="min-width:' + (64 + days.length * (locs.length * COL_W[hdrMode] + 2)) + 'px">' + head +
            '<div class="v2-body" style="height:' + height + 'px"><div class="v2-times">' + times + '</div>' +
            '<div class="v2-cols">' + cols + '</div></div></div>');

        if (scrollToMin !== null) {
            // A hidden tab cannot scroll: keep the request until the grid is visible.
            if (el.clientHeight > 0) {
                el.scrollTop = scrollToMin * p;
                el.scrollLeft = 0;
                scrollToMin = null;
            }
        } else {
            el.scrollTop = keepTop;
            el.scrollLeft = keepLeft;
        }
        renderUnassigned();
    }

    /* Show the 7 days starting at `date` (keeps the vertical scroll position).
     * `focus` is the day for day view (default: the first day). */
    function goTo(date, focus) {
        if (!U.isDate(date)) { return; }
        weekStart = date;
        focusDate = focus || date;
        scrollToMin = $scroller[0].scrollTop / ppm();
        render();
    }

    /* Re-render keeping the time of day in view; the columns start from the left again. */
    function rerender() {
        scrollToMin = $scroller[0].scrollTop / ppm();
        render();
    }

    /* ---------- tab strip: locations (week view) or the 7 dates (day view) ----------
     * Click a tab to switch; drop a dragged shift on a tab to move it there. */
    function renderStrip(allLocs) {
        var html, weekEnd = U.addDays(weekStart, NUM_DAYS - 1), todayNum = U.dayNum(U.today());
        function countHtml(n) {
            return '<span class="v2-tab-count' + (n ? '' : ' zero') + '"><i class="fa fa-user"></i> ' + n + '</span>';
        }
        if (viewMode === 'week') {
            html = '<span class="v2-strip-label">Location</span>';
            allLocs.forEach(function (l, i) {
                var lm = locMark(i), drivers = {};
                // drivers with a shift at this location in the visible week
                SBData.mappingsAt(l.id).forEach(function (m) {
                    if (U.datesIntersect(m, { shift_date: weekStart, end_date: weekEnd })) { drivers[m.driver_id] = true; }
                });
                html += '<button type="button" class="v2-tab' + (l.id === focusLoc ? ' active' : '') + '" data-tab-loc="' + l.id + '"' +
                    ' title="' + U.esc(l.address1 + ', ' + l.address2) + '">' +
                    '<i class="v2-loc-badge" style="background:' + lm.color + '">' + lm.code + '</i>' + U.esc(l.location_title) +
                    countHtml(Object.keys(drivers).length) + '</button>';
            });
            html += '<span class="v2-strip-hint"><i class="fa fa-hand-pointer-o"></i> Drop a shift on a location to move it there</span>';
        } else {
            html = '<span class="v2-strip-label">Day</span>';
            visibleDays().forEach(function (d) {
                var n = U.dayNum(d), drivers = {};
                allLocs.forEach(function (l) {
                    SBData.mappingsAt(l.id).forEach(function (m) { if (U.covers(m, d)) { drivers[m.driver_id] = true; } });
                });
                html += '<button type="button" class="v2-tab' + (d === focusDate ? ' active' : '') + (n === todayNum ? ' today' : '') +
                    (n < todayNum ? ' past' : '') + '" data-tab-date="' + d + '">' +
                    U.esc(U.fmtDate(d)) + (n === todayNum ? ' · Today' : '') + countHtml(Object.keys(drivers).length) + '</button>';
            });
            html += '<span class="v2-strip-hint"><i class="fa fa-hand-pointer-o"></i> Drop a shift on a day to move it there</span>';
        }
        $('#v2-strip').html(html);
    }

    /* Tab under the pointer while dragging a shift, or null. */
    function tabAt(x, y) {
        var found = null;
        $('#v2-strip .v2-tab').each(function () {
            var r = this.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { found = this; }
        });
        return found;
    }

    function highlightTab(tab, bad) {
        $('#v2-strip .v2-tab').removeClass('drop-hover drop-bad');
        if (tab) { $(tab).addClass(bad ? 'drop-bad' : 'drop-hover'); }
    }

    /* Scroll so a shift's block is in view (after a save from the drawer). */
    function reveal(mappingId) {
        var b = $scroller.find('.v2-block[data-id="' + mappingId + '"]')[0];
        if (!b) { return; }
        var el = $scroller[0], r = b.getBoundingClientRect(), s = el.getBoundingClientRect();
        var headH = $scroller.find('.v2-head').outerHeight() || 0;
        if (r.left < s.left + 64 || r.right > s.right) { el.scrollLeft += r.left - s.left - 64 - 20; }
        if (r.top < s.top + headH || r.top > s.bottom - 40) { el.scrollTop += r.top - s.top - headH - 20; }
    }

    function renderUnassigned() {
        var all = SBData.unassignedDrivers();
        var q = $.trim($('#v2-un-q').val()).toLowerCase();
        var list = all.filter(function (d) {
            return !q || d.full_name.toLowerCase().indexOf(q) !== -1 || String(d.mobile_no).indexOf(q) !== -1;
        });
        var html = '';
        $('#v2-un-q').closest('.v2-un-search').toggle(all.length > 0);
        if (!all.length) {
            html += '<span class="sb-muted">Every driver has an assignment. Click an empty slot to add a second one.</span>';
        } else if (!list.length) {
            html += '<span class="sb-muted">No unassigned driver matches "' + U.esc(q) + '".</span>';
        }
        list.forEach(function (d) {
            html += '<span class="sb-chip" data-driver="' + d.id + '" title="Drag onto a location column">' +
                '<span class="sb-ini" style="background:' + U.color(d.full_name) + '">' + U.esc(U.initials(d.full_name)) + '</span>' +
                U.esc(d.full_name) + ' <span class="sb-muted">' + U.esc(d.mobile_no) + '</span></span>';
        });
        if (list.length) { html += '<span class="sb-muted" style="margin-left:auto">Drag a driver onto the grid to assign</span>'; }
        $('#v2-un-list').html(html);
    }

    function flash(mappingId) {
        $scroller.find('.v2-block[data-id="' + mappingId + '"]').addClass('flash');
    }

    function colAt(x, y) {
        var found = null;
        $scroller.find('.v2-col').each(function () {
            var r = this.getBoundingClientRect();
            if (x >= r.left && x < r.right && (y === undefined || (y >= r.top - 60 && y <= r.bottom))) { found = this; }
        });
        return found;
    }

    function minuteAt(col, clientY) {
        return (clientY - col.getBoundingClientRect().top) / ppm();
    }

    /* Highlight the target date + location column (red when the date is in the past). */
    function highlight(col) {
        $scroller.find('.drop-hover, .drop-bad').removeClass('drop-hover drop-bad');
        if (col) {
            var loc = $(col).data('loc'), date = $(col).attr('data-date');
            var cls = U.dayNum(date) < U.dayNum(U.today()) ? 'drop-bad' : 'drop-hover';
            $(col).addClass(cls);
            $scroller.find('.v2-colhead[data-loc="' + loc + '"][data-date="' + date + '"]').addClass(cls);
            $scroller.find('.v2-dayhead-group[data-date="' + date + '"] .v2-dayhead').addClass(cls);
        }
    }

    function tip(text, x, y) {
        var $t = $('#v2-drag-tip');
        if (!$t.length) { $t = $('<div id="v2-drag-tip" class="v2-drag-tip"></div>').appendTo('body'); }
        $t.text(text).css({ left: x + 14, top: y + 14 }).show();
    }
    function hideTip() { $('#v2-drag-tip').remove(); }

    function autoScroll(e) {
        var r = $scroller[0].getBoundingClientRect(), el = $scroller[0];
        // only while inside the grid, so hovering the tabs above it doesn't scroll
        if (e.clientY > r.bottom - 30) { el.scrollTop += 14; } else if (e.clientY > r.top && e.clientY < r.top + 70) { el.scrollTop -= 14; }
        if (e.clientX > r.right - 30) { el.scrollLeft += 14; } else if (e.clientX < r.left + 90) { el.scrollLeft -= 14; }
    }

    /* ---------- repeating shifts: "only this day" splits the series ----------
     * Returns the batch that takes day `occ` out of series m (the rest keeps repeating)
     * and, when dayChange is given, adds that day back as its own shift (always last). */
    function splitBatch(m, occ, dayChange) {
        var base = U.toChange(m), from = m.shift_date, to = U.endDate(m), batch = [];
        var before = U.dayNum(occ) > U.dayNum(from) ? [from, U.addDays(occ, -1)] : null;
        var after = U.dayNum(occ) < U.dayNum(to) ? [U.addDays(occ, 1), to] : null;
        var keep = before || after;   // the first remaining part keeps the mapping's id
        if (keep) { batch.push($.extend({}, base, { shift_date: keep[0], end_date: keep[1] })); }
        if (before && after) { batch.push($.extend({}, base, { mapping_id: null, shift_date: after[0], end_date: after[1] })); }
        if (dayChange) { batch.push($.extend({}, dayChange, { mapping_id: keep ? null : m.id })); }
        return batch;
    }

    /* Validate a batch; errors anywhere block it, warnings are reported for the edited row (the last one). */
    function check(batch) {
        var all = R.validate(batch), errors = [];
        all.forEach(function (r) { errors = errors.concat(r.errors); });
        return { errors: errors, warnings: all[all.length - 1].warnings };
    }

    /* ---------- notifications ----------
     * Errors and warnings open a centred pop-up (SBNotice); routine confirmations
     * ("Saved", "Removed") go to the status bar above the grid, with an Undo link. */
    var REASON_ERROR = 'Nothing was changed. Fix the item above and try again.';
    var REASON_WARN = 'You can still save: the shift will be marked as a Conflict on the grid until it is resolved.';
    var statusTimer = null;

    function notifyError(title, errors, reason) {
        SBNotice.show({ type: 'error', title: title, messages: errors, reason: reason || REASON_ERROR });
    }

    /* "Save anyway?" for a change with warnings. cb(true) on Yes, cb(false) otherwise. */
    function confirmWarnings(label, warnings, cb) {
        SBNotice.show({
            type: 'warning', title: 'Save with conflict?',
            messages: [label].concat(warnings), reason: REASON_WARN,
            buttons: [
                { label: 'Yes, save anyway', value: 'yes', primary: true, icon: 'fa-check' },
                { label: 'Cancel', value: '' }
            ]
        }, function (v) { cb(v === 'yes'); });
    }

    /* Status bar: short-lived, non-blocking confirmation. undo = show an "Undo" link. */
    function status(text, type, title, undo) {
        var icons = { success: 'fa-check-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        type = icons[type] ? type : 'info';
        clearTimeout(statusTimer);
        $('#v2-status').attr('class', 'v2-status v2-status-' + type).html(
            '<i class="fa ' + icons[type] + '"></i> ' + (title ? '<strong>' + U.esc(title) + '</strong> ' : '') +
            '<span class="v2-status-text">' + U.esc(text) + '</span>' +
            (undo ? ' <button type="button" class="btn btn-link btn-xs v2-status-undo"><i class="fa fa-undo"></i> Undo</button>' : '') +
            '<button type="button" class="v2-status-x" aria-label="Dismiss">&times;</button>').show();
        statusTimer = setTimeout(hideStatus, 8000);
    }
    function hideStatus() { clearTimeout(statusTimer); $('#v2-status').fadeOut(200); }

    /* ---------- save changes through the shared rules ----------
     * Errors block the change; warnings ask first. done(true) once saved. */
    function commit(batch, label, focusId, done) {
        var res = check(batch);
        done = done || $.noop;
        if (res.errors.length) {
            render();   // snap back
            notifyError('Change not saved', res.errors);
            done(false);
            return;
        }
        function apply() {
            SBData.applyChanges(batch, label, 'View 2');
            flash(focusId || batch[batch.length - 1].mapping_id || SBData.mappings().slice(-1)[0].id);
            status(label, res.warnings.length ? 'warning' : 'success', res.warnings.length ? 'Saved with conflict.' : 'Saved.', true);
            done(true);
        }
        if (!res.warnings.length) { apply(); return; }
        scopeAsk = true;   // keep the dragged block where it was dropped while the user decides
        confirmWarnings(label, res.warnings, function (yes) {
            scopeAsk = false;
            if (yes) { apply(); } else { render(); done(false); }
        });
    }

    /* "Only this day" / "All days" prompt after dragging a repeating shift. cb('one' | 'all') or nothing on cancel. */
    function askScope(m, occ, x, y, cb) {
        scopeAsk = true;
        var name = R.driverName(m.driver_id);
        var $ov = $('<div class="v2-scope-overlay"></div>').appendTo('body');
        var $pop = $('<div class="v2-scope-pop" role="dialog" aria-label="Apply change to">' +
            '<div><i class="fa fa-repeat"></i> <strong>' + U.esc(name) + '</strong> repeats daily, ' +
                U.esc(U.datesLabel(m.shift_date, m.end_date)) + '.</div>' +
            '<div class="sb-muted" style="margin:4px 0 8px">Apply this change to:</div>' +
            '<button type="button" class="btn btn-primary btn-sm" data-scope="one">Only ' + U.esc(U.fmtDate(occ)) + '</button> ' +
            '<button type="button" class="btn btn-default btn-sm" data-scope="all">All days</button> ' +
            '<button type="button" class="btn btn-link btn-sm" data-scope="">Cancel</button></div>').appendTo('body');
        $pop.css({
            left: Math.max(8, Math.min(x + 12, window.innerWidth - $pop.outerWidth() - 8)),
            top: Math.max(8, Math.min(y + 12, window.innerHeight - $pop.outerHeight() - 8))
        });
        $pop.find('[data-scope="one"]').trigger('focus');
        function done(scope) {
            $ov.remove(); $pop.remove();
            $(document).off('keydown.v2scope');
            scopeAsk = false;
            if (scope) { cb(scope); } else { render(); }
        }
        $pop.on('click', '[data-scope]', function () { done($(this).data('scope')); });
        $ov.on('click', function () { done(''); });
        $(document).on('keydown.v2scope', function (e) { if (e.key === 'Escape') { done(''); } });
    }

    /* ---------- block drag / resize ---------- */
    function onBlockDown(e) {
        if (e.button !== 0 || drawer.open) { return; }
        var $b = $(this), m = SBData.mapping($b.data('id'));
        var $t = $(e.target);
        drag = {
            el: this, $b: $b, m: $.extend({}, m), part: $b.data('part'), segDate: $b.closest('.v2-col').attr('data-date'),
            occ: $b.attr('data-occ'),   // the day this block belongs to (repeating shifts have one per day)
            kind: $t.closest('.v2-h-top').length ? 'top' : ($t.closest('.v2-h-bot').length ? 'bot' : 'move'),
            x0: e.clientX, y0: e.clientY, st0: $scroller[0].scrollTop, sl0: $scroller[0].scrollLeft,
            top0: parseFloat(this.style.top), h0: parseFloat(this.style.height), moved: false, result: null
        };
        try { this.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
    }

    function onBlockMove(e) {
        if (!drag) { return; }
        var dx = e.clientX - drag.x0 + ($scroller[0].scrollLeft - drag.sl0);
        var dy = e.clientY - drag.y0 + ($scroller[0].scrollTop - drag.st0);
        if (!drag.moved && Math.abs(dx) < 4 && Math.abs(dy) < 4) { return; }
        if (!drag.moved) {
            drag.moved = true;
            drag.$b.addClass('dragging');
            // the other half of an overnight shift fades while this half moves
            $scroller.find('.v2-block[data-id="' + drag.m.id + '"][data-occ="' + drag.occ + '"]').not(drag.el).addClass('drag-sibling');
        }
        autoScroll(e);

        // Times are minutes from midnight of this block's day (may run past 1440).
        var p = ppm(), delta = snap(dy / p), m = drag.m;
        var s = U.toMin(m.shift_start_time), sp = U.span(drag.occ, m.shift_start_time, m.shift_end_time), len = sp[1] - sp[0];
        var segTop = drag.top0 / p;   // block's own segment start in minutes
        var res = { loc: m.location_id }, newStart;

        var tab = drag.kind === 'move' ? tabAt(e.clientX, e.clientY) : null;
        res.tab = tab;
        if (tab) {
            // Over a tab: same time, other location (week view) or other date (day view).
            highlight(null);
            newStart = s;
            if (viewMode === 'week') {
                res.loc = +$(tab).attr('data-tab-loc');
            } else {
                newStart = s + (U.dayNum($(tab).attr('data-tab-date')) - U.dayNum(drag.occ)) * U.DAY;
            }
            drag.$b.css('transform', 'translate(' + dx + 'px,' + dy + 'px)');
        } else if (drag.kind === 'move') {
            // Another column can change the location and/or the date (by whole days).
            var col = colAt(e.clientX);
            highlight(col);
            var dayShift = 0;
            if (col) {
                res.loc = +$(col).data('loc');
                dayShift = U.dayNum($(col).attr('data-date')) - U.dayNum(drag.segDate);
            }
            newStart = s + dayShift * U.DAY + delta;
            drag.$b.css('transform', 'translate(' + dx + 'px,' + (delta * p) + 'px)');
        } else {
            // Edge drag keeps the shift at a fixed SHIFT_LEN: the dragged edge sets
            // the time and the opposite edge follows (01:00–09:00, top +2h -> 03:00–11:00).
            newStart = drag.kind === 'top' ? s + delta : s + len + delta - SHIFT_LEN;
            len = SHIFT_LEN;
            drag.$b.css({
                top: (segTop + newStart - s) * p,
                height: (drag.part === 'only' ? SHIFT_LEN * p : drag.h0 + 1) - 1
            });
        }
        var at = fromAbs(drag.occ, newStart);
        res.date = at.date;
        res.start = at.time;
        res.end = U.fmt(newStart + len);
        drag.result = res;

        var past = U.dayNum(res.date) < U.dayNum(U.today());
        if (drag.kind === 'move') { highlightTab(tab, past); }
        tip(U.fmtDate(res.date) + ' · ' + res.start + ' – ' + res.end +
            (res.loc !== m.location_id ? '  →  ' + SBData.location(res.loc).location_title : '') +
            (past ? '  ·  past date, not allowed' : ''), e.clientX, e.clientY);
    }

    function onBlockUp(e) {
        if (!drag) { return; }
        var d = drag;
        drag = null;
        hideTip();
        highlight(null);
        highlightTab(null);
        if (!d.moved) { openEdit(d.m.id, d.occ); return; }
        suppressClickUntil = Date.now() + 400;

        var r = d.result, m = d.m;
        if (!r || (r.loc === m.location_id && r.date === d.occ && r.start === m.shift_start_time && r.end === m.shift_end_time)) {
            render();
            return;
        }
        // Dropped on a tab: the shift leaves this view, so the tab flashes to show where it went.
        var tabSel = !r.tab ? null : viewMode === 'week' ? '[data-tab-loc="' + r.loc + '"]' : '[data-tab-date="' + r.date + '"]';
        function save(batch, label, focusId) {
            commit(batch, label, focusId, function (ok) { if (ok && tabSel) { $('#v2-strip .v2-tab' + tabSel).addClass('flash'); } });
        }
        var moved = { driver_id: m.driver_id, location_id: r.loc, shift_type: m.shift_type, shift_start_time: r.start, shift_end_time: r.end };
        if (!U.isSeries(m)) {
            var single = $.extend({ mapping_id: m.id, shift_date: r.date }, moved);
            save([single], R.describe(single));
            return;
        }
        askScope(m, d.occ, e.clientX, e.clientY, function (scope) {
            if (scope === 'all') {
                // the whole range moves by the same number of days as the dragged day
                var k = U.dayNum(r.date) - U.dayNum(d.occ);
                var all = $.extend({ mapping_id: m.id, shift_date: U.addDays(m.shift_date, k), end_date: U.addDays(U.endDate(m), k) }, moved);
                save([all], R.describe(all), m.id);
            } else {
                var day = $.extend({ shift_date: r.date, end_date: null }, moved);
                save(splitBatch(m, d.occ, day), dayLabel(day, m, d.occ));
            }
        });
    }

    /* "Ganesh More: 08:00 - 16:00 → 09:00 - 17:00 (only Tue, 21 Oct)" */
    function dayLabel(day, m, occ) {
        return R.describe(day, $.extend({}, m, { shift_date: occ, end_date: null })) + ' (only ' + U.fmtDate(occ) + ')';
    }

    /* ---------- unassigned chip drag ---------- */
    function onChipDown(e) {
        if (e.button !== 0) { return; }
        chipDrag = { el: this, driver: +$(this).data('driver'), x0: e.clientX, y0: e.clientY, moved: false, $ghost: null };
        try { this.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
    }

    function onChipMove(e) {
        if (!chipDrag) { return; }
        if (!chipDrag.moved && Math.abs(e.clientX - chipDrag.x0) < 4 && Math.abs(e.clientY - chipDrag.y0) < 4) { return; }
        if (!chipDrag.moved) {
            chipDrag.moved = true;
            chipDrag.$ghost = $(chipDrag.el).clone().addClass('sb-drag-ghost').appendTo('body');
        }
        chipDrag.$ghost.css({ left: e.clientX - 20, top: e.clientY - 14 });
        var col = colAt(e.clientX, e.clientY);
        highlight(col);
        if (col) {
            var t = U.fmt(clamp(snap(minuteAt(col, e.clientY)), 0, 1425));
            tip(U.fmtDate($(col).attr('data-date')) + ' · ' + t + '  →  ' + SBData.location($(col).data('loc')).location_title, e.clientX, e.clientY);
        } else {
            hideTip();
        }
    }

    function onChipUp(e) {
        if (!chipDrag) { return; }
        var c = chipDrag;
        chipDrag = null;
        if (c.$ghost) { c.$ghost.remove(); }
        hideTip();
        highlight(null);
        if (!c.moved) {
            // assign to what is on screen: the week view's location / the day view's date
            var first = SBData.locations(corpId)[0];
            var loc = viewMode === 'week' ? focusLoc : (first ? first.id : null);
            var date = viewMode === 'day' ? focusDate : weekStart;
            if (U.dayNum(date) < U.dayNum(U.today())) { date = U.today(); }
            openAssign(loc, date, 8 * 60, c.driver);
            return;
        }
        var col = colAt(e.clientX, e.clientY);
        if (col) {
            openAssign(+$(col).data('loc'), $(col).attr('data-date'), clamp(snap(minuteAt(col, e.clientY)), 0, 1425), c.driver);
        }
    }

    /* ---------- drawer ---------- */
    function driverOptions(selected, lockedId) {
        var html = '', un = SBData.unassignedDrivers(), unIds = {};
        if (lockedId) {
            var d = SBData.driver(lockedId);
            return '<option value="' + d.id + '">' + U.esc(d.full_name + ' - ' + d.mobile_no) + '</option>';
        }
        html += '<option value="">-- Select driver --</option>';
        if (un.length) {
            html += '<optgroup label="Unassigned drivers">';
            un.forEach(function (d) {
                unIds[d.id] = true;
                html += '<option value="' + d.id + '"' + (d.id === +selected ? ' selected' : '') + '>' + U.esc(d.full_name + ' - ' + d.mobile_no) + '</option>';
            });
            html += '</optgroup>';
        }
        html += '<optgroup label="All drivers (adds another assignment)">';
        SBData.drivers().forEach(function (d) {
            if (unIds[d.id]) { return; }
            html += '<option value="' + d.id + '"' + (d.id === +selected ? ' selected' : '') + '>' + U.esc(d.full_name + ' - ' + d.mobile_no) + '</option>';
        });
        return html + '</optgroup>';
    }

    function fillDrawerCorp(selectedCorp) {
        var html = '';
        SBData.corporates().forEach(function (c) {
            html += '<option value="' + c.id + '"' + (c.id === +selectedCorp ? ' selected' : '') + '>' + U.esc(c.corporatename) + '</option>';
        });
        $('#v2-d-corp').html(html);
    }

    function fillDrawerLoc(selectedLoc) {
        var corp = $('#v2-d-corp').val();
        $('#v2-d-loc').html('<option value="">-- Select location --</option>' + U.locationOptions(selectedLoc, corp));
    }

    function setInfo(corporateId, locationId) {
        var c = SBData.corporate(corporateId), l = SBData.location(locationId);
        $('#v2-d-info').html(
            '<p class="sb-info-line"><b>Standby Corporate</b> - ' + U.esc(c ? c.corporatename : '') + '</p>' +
            '<p class="sb-info-line"><b>Standby Company</b> - ' + U.esc(c ? c.companyname : '') + '</p>' +
            '<p class="sb-info-line"><b>Location</b> - ' + U.esc(l ? l.location_title : '–') + '</p><hr style="margin:10px 0">');
    }

    function clearMsgs() { $('#v2-d-msgs').empty(); }

    function showDrawer() {
        drawer.open = true;
        clearMsgs();
        $('body').addClass('sb-drawer-open');
        $('#v2-backdrop').fadeIn(150);
        $('#v2-drawer').addClass('open').attr('aria-hidden', 'false');
        setTimeout(function () { $('#v2-drawer').find('select:enabled, input').first().trigger('focus'); }, 230);
    }

    function closeDrawer() {
        drawer.open = false;
        $('body').removeClass('sb-drawer-open');
        $('#v2-backdrop').fadeOut(150);
        $('#v2-drawer').removeClass('open').attr('aria-hidden', 'true');
    }

    /* Scope of an edit on a repeating shift: 'one' = only the clicked day, 'all' = the whole From–To range. */
    function scope() { return drawer.series ? $('input[name="v2-d-scope"]:checked').val() : 'all'; }

    /* Fill From / To for the current scope. */
    function fillDrawerDates() {
        var m = drawer.mode === 'edit' ? SBData.mapping(drawer.mappingId) : null;
        if (!m) { return; }
        var one = scope() === 'one';
        $('#v2-d-date').val(one ? drawer.occ : m.shift_date);
        $('#v2-d-to').val(one ? drawer.occ : U.endDate(m));
        $('#v2-d-remove span').text(one ? 'Remove this day' : 'Remove from location');
    }

    function openEdit(id, occ) {
        var m = SBData.mapping(id);
        if (!m) { return; }
        drawer.mode = 'edit';
        drawer.mappingId = id;
        drawer.series = U.isSeries(m);
        drawer.occ = occ || m.shift_date;
        $('#v2-d-title').text('Edit assignment');
        setInfo(m.corporate_id, m.location_id);
        $('#v2-d-driver').html(driverOptions(null, m.driver_id)).prop('disabled', true);
        fillDrawerCorp(m.corporate_id);
        fillDrawerLoc(m.location_id);
        $('#v2-d-type').val(m.shift_type);
        $('#v2-d-scope').toggle(drawer.series);
        $('#v2-d-scope-day').text(U.fmtDate(drawer.occ));
        $('#v2-d-scope-range').text(U.datesLabel(m.shift_date, m.end_date));
        $('input[name="v2-d-scope"][value="one"]').prop('checked', true);
        fillDrawerDates();
        $('#v2-d-date, #v2-d-to').attr('min', U.today());
        $('#v2-d-start').val(m.shift_start_time);
        $('#v2-d-end').val(m.shift_end_time);
        $('#v2-d-remove').show();
        showDrawer();
    }

    function openAssign(locationId, date, startMin, driverId) {
        var loc = SBData.location(locationId);
        drawer.mode = 'assign';
        drawer.mappingId = null;
        drawer.series = false;
        $('#v2-d-title').text('Assign driver');
        setInfo(loc ? loc.corporate_id : corpId, locationId);
        $('#v2-d-driver').html(driverOptions(driverId)).prop('disabled', false);
        fillDrawerCorp(loc ? loc.corporate_id : corpId);
        fillDrawerLoc(locationId);
        $('#v2-d-type').val('Permanent');
        $('#v2-d-scope').hide();
        $('#v2-d-date, #v2-d-to').val(date).attr('min', U.today());
        $('#v2-d-start').val(U.fmt(startMin));
        $('#v2-d-end').val(U.fmt(startMin + SHIFT_LEN));
        $('#v2-d-remove').hide();
        showDrawer();
    }

    /* The batch the drawer would save, its label and the shift to focus afterwards. */
    function drawerBatch() {
        var fields = {
            driver_id: +$('#v2-d-driver').val(),
            location_id: $('#v2-d-loc').val() ? +$('#v2-d-loc').val() : null,
            shift_type: $('#v2-d-type').val(),
            shift_date: $('#v2-d-date').val(),
            end_date: $('#v2-d-to').val() || null,
            shift_start_time: $('#v2-d-start').val(),
            shift_end_time: $('#v2-d-end').val()
        };
        var m = drawer.mode === 'edit' ? SBData.mapping(drawer.mappingId) : null;
        if (m && scope() === 'one') {
            return { batch: splitBatch(m, drawer.occ, fields), label: dayLabel(fields, m, drawer.occ), main: fields };
        }
        var change = $.extend({ mapping_id: m ? m.id : null }, fields);
        return { batch: [change], label: R.describe(change), main: change, focus: m ? m.id : null };
    }

    function drawerSave() {
        if (!+$('#v2-d-driver').val()) {
            $('#v2-d-msgs').html(R.messagesHtml({ errors: ['Select a driver.'], warnings: [] }));
            return;
        }
        var b = drawerBatch();
        var res = check(b.batch);
        $('#v2-d-msgs').html(R.messagesHtml(res));
        if (res.errors.length) { notifyError('Change not saved', res.errors); return; }
        if (res.warnings.length) {
            confirmWarnings(b.label, res.warnings, function (yes) { if (yes) { drawerApply(b, res); } });
            return;
        }
        drawerApply(b, res);
    }

    function drawerApply(b, res) {
        var change = b.main, name = R.driverName(change.driver_id);
        var newCorp = SBData.location(change.location_id).corporate_id;
        closeDrawer();
        // No day of the shift inside the visible 7 days: page the range (in whole weeks) to its From date.
        var lastVisible = U.addDays(weekStart, NUM_DAYS - 1);
        if (U.dayNum(change.shift_date) > U.dayNum(lastVisible) || U.dayNum(U.endDate(change)) < U.dayNum(weekStart)) {
            weekStart = U.addDays(weekStart, Math.floor((U.dayNum(change.shift_date) - U.dayNum(weekStart)) / NUM_DAYS) * NUM_DAYS);
        }
        // Follow the shift: week view switches to its location, day view to its date.
        if (newCorp === corpId) {
            if (viewMode === 'week') { focusLoc = change.location_id; }
            if (viewMode === 'day' && !U.covers(change, focusDate)) {
                focusDate = isVisible(change.shift_date) ? change.shift_date : weekStart;
            }
        }
        SBData.applyChanges(b.batch, b.label, 'View 2');
        var saved = b.focus || b.batch[b.batch.length - 1].mapping_id || SBData.mappings().slice(-1)[0].id;
        if (newCorp === corpId) { reveal(saved); }
        flash(saved);
        if (newCorp !== corpId) {
            // The block leaves this calendar: offer to follow it.
            SBNotice.show({
                type: 'info', title: 'Moved to another corporate',
                message: name + ' moved to ' + U.placeLabel(change.location_id) + '.',
                reason: 'This calendar shows ' + SBData.corporate(corpId).corporatename + ' only. Switch the corporate to see the shift.',
                buttons: [
                    { label: 'Show ' + SBData.corporate(newCorp).corporatename, value: 'go', primary: true, icon: 'fa-arrow-right' },
                    { label: 'Stay here', value: '' }
                ]
            }, function (v) {
                if (v !== 'go') { return; }
                corpId = newCorp;
                focusLoc = change.location_id;
                render();
                reveal(saved);
                flash(saved);
            });
        } else {
            status(b.label, res.warnings.length ? 'warning' : 'success', res.warnings.length ? 'Saved with conflict.' : 'Saved.', true);
        }
    }

    function drawerRemove() {
        var m = SBData.mapping(drawer.mappingId);
        if (!m) { closeDrawer(); return; }
        var one = scope() === 'one';
        SBNotice.show({
            type: 'confirm', title: one ? 'Remove this day?' : 'Remove from location?',
            message: 'Remove ' + R.driverName(m.driver_id) + ' from ' + U.placeLabel(m.location_id) +
                (one ? ' on ' + U.fmtDate(drawer.occ) + ' only' : ' (' + U.mappingLabel(m) + ')') + '?',
            reason: one ? 'The other days of this repeating shift stay as they are.' : 'The location loses this driver for the whole shift. You can Undo right after.',
            buttons: [
                { label: 'Yes, remove', value: 'yes', primary: true, danger: true, icon: 'fa-trash' },
                { label: 'Cancel', value: '' }
            ]
        }, function (v) { if (v === 'yes') { removeNow(m); } });
    }

    function removeNow(m) {
        var label = 'Removed ' + R.driverName(m.driver_id) + ' from ' + U.placeLabel(m.location_id);
        if (scope() === 'one') {
            // take only this day out of the repeating shift
            var batch = splitBatch(m, drawer.occ, null);
            label += ' on ' + U.fmtDate(drawer.occ);
            var res = check(batch);
            if (res.errors.length) {
                $('#v2-d-msgs').html(R.messagesHtml({ errors: res.errors, warnings: [] }));
                notifyError('Not removed', res.errors);
                return;
            }
            closeDrawer();
            SBData.applyChanges(batch, label, 'View 2');
        } else {
            closeDrawer();
            SBData.removeMapping(m.id, label, 'View 2');
        }
        status(label + '.', 'success', 'Removed.', true);
    }

    /* ---------- events ---------- */
    function bind() {
        $('#v2-corp').on('change', function () {
            corpId = +$(this).val();
            scrollToMin = 7 * 60;
            render();
        });

        $('#v2 .v2-zoom').on('click', '.btn', function () {
            var topMin = $scroller[0].scrollTop / ppm();
            zoom = +$(this).data('zoom');
            $(this).addClass('active').siblings().removeClass('active');
            scrollToMin = topMin;
            render();
        });

        // Column headers: compact letter badges + legend, or full location names (wider columns)
        $('#v2 .v2-colmode').on('click', '.btn', function () {
            var mode = $(this).data('colmode'), el = $scroller[0];
            if (mode === colMode) { return; }
            var ratio = el.scrollWidth > el.clientWidth ? el.scrollLeft / (el.scrollWidth - el.clientWidth) : 0;
            colMode = mode;
            $(this).addClass('active').attr('aria-pressed', 'true').siblings().removeClass('active').attr('aria-pressed', 'false');
            render();
            el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);   // stay at about the same day
        });

        $scroller.on('pointerdown', '.v2-block', onBlockDown)
            .on('pointermove', '.v2-block', onBlockMove)
            .on('pointerup pointercancel', '.v2-block', onBlockUp);

        // Hover hint + click on an empty slot -> assign
        $scroller.on('pointermove', '.v2-col', function (e) {
            if (drag || chipDrag || $(e.target).closest('.v2-block').length) { $(this).find('.v2-slot-hint').css('visibility', 'hidden'); return; }
            var min = Math.floor(minuteAt(this, e.clientY) / zoom) * zoom;
            $(this).find('.v2-slot-hint').css({ visibility: 'visible', top: min * ppm(), height: zoom * ppm() })
                .text('+ Assign at ' + U.fmt(min));
        });
        $scroller.on('click', '.v2-col', function (e) {
            if (Date.now() < suppressClickUntil || $(e.target).closest('.v2-block').length) { return; }
            var date = $(this).attr('data-date');
            if (U.dayNum(date) < U.dayNum(U.today())) {
                notifyError('Not allowed', ['Shifts cannot be added on a past date (' + U.fmtDate(date) + ').'],
                    'Pick today or a later date. Use Next week or Today in the date navigator.');
                return;
            }
            var min = Math.floor(minuteAt(this, e.clientY) / zoom) * zoom;
            openAssign(+$(this).data('loc'), date, min);
        });

        // Linked halves of an overnight shift highlight together
        $scroller.on('mouseenter mouseleave', '.v2-block', function (e) {
            $scroller.find('.v2-block[data-id="' + $(this).data('id') + '"][data-occ="' + $(this).attr('data-occ') + '"]')
                .toggleClass('linked', e.type === 'mouseenter');
        });

        // Date navigator
        $('#v2 .v2-datenav').on('click', '[data-nav]', function () {
            var nav = $(this).data('nav');
            if (nav === 'today') { goTo(startFor(U.today()), U.today()); } else { goTo(U.addDays(weekStart, +nav), U.addDays(focusDate, +nav)); }
        });
        $('#v2-jump').on('change', function () {
            var d = $(this).val();
            if (U.isDate(d)) { goTo(startFor(d), d); }
        });
        // Week starts on Monday / on today: keeps roughly the same week in view
        $('#v2').on('click', '[data-weekstart]', function () {
            var mode = $(this).data('weekstart');
            if (mode === weekMode) { return; }
            weekMode = mode;
            try { localStorage.setItem(WEEK_KEY, mode); } catch (e) { /* ignore */ }
            var anchor = isVisible(U.today()) ? U.today() : weekStart;   // the current week follows today
            goTo(startFor(anchor), focusDate);   // render() moves the day view's date back inside the week if needed
        });

        // Week (one location) / Day (all locations)
        $('#v2').on('click', '[data-viewmode]', function () {
            var mode = $(this).data('viewmode');
            if (mode !== viewMode) { viewMode = mode; rerender(); }
        });
        // Tabs: pick the location (week view) or the date (day view)
        $('#v2-strip').on('click', '.v2-tab', function () {
            if (viewMode === 'week') { focusLoc = +$(this).attr('data-tab-loc'); } else { focusDate = $(this).attr('data-tab-date'); }
            rerender();
        });
        // Headers drill across: a date in week view opens that day; a location in day view opens its week
        $scroller.on('click', '.v2-dayhead.v2-drill', function () {
            viewMode = 'day';
            focusDate = $(this).closest('.v2-dayhead-group').attr('data-date');
            rerender();
        });
        $scroller.on('click', '.v2-colhead.v2-drill', function () {
            viewMode = 'week';
            focusLoc = +$(this).attr('data-loc');
            rerender();
        });

        $('#v2-unassigned').on('pointerdown', '.sb-chip', onChipDown)
            .on('pointermove', '.sb-chip', onChipMove)
            .on('pointerup pointercancel', '.sb-chip', onChipUp);
        $('#v2-un-q').on('input', renderUnassigned);

        // Drawer
        $('#v2-d-corp').on('change', function () { fillDrawerLoc(null); });
        $('#v2-drawer').on('change input', '.v2-d-f', clearMsgs);
        // Picking a start time suggests an end SHIFT_LEN later; the user can still change the end freely.
        // Repeating shifts: switching between "only this day" and "all days" refills From / To
        $('#v2-drawer').on('change', 'input[name="v2-d-scope"]', function () { fillDrawerDates(); clearMsgs(); });
        // To date never sits before From (same day = no repeat)
        $('#v2-d-date').on('change', function () {
            var from = $(this).val(), to = $('#v2-d-to').val();
            if (U.isDate(from) && (!U.isDate(to) || U.dayNum(to) < U.dayNum(from))) { $('#v2-d-to').val(from); }
        });
        $('#v2-d-start').on('change', function () {
            var s = U.toMin($(this).val());
            if (!isNaN(s)) { $('#v2-d-end').val(U.fmt(s + SHIFT_LEN)); }
        });
        $('#v2-d-save').on('click', drawerSave);
        $('#v2-d-remove').on('click', drawerRemove);
        $('#v2-drawer .v2-d-cancel, #v2-backdrop').on('click', closeDrawer);
        $(document).on('keydown', function (e) { if (e.key === 'Escape' && drawer.open && !SBNotice.isOpen()) { closeDrawer(); } });

        // Status bar
        $('#v2-status').on('click', '.v2-status-x', hideStatus);
        $('#v2-status').on('click', '.v2-status-undo', function () {
            var entry = SBData.undo();
            if (entry) { status(entry.label, 'info', 'Undone:'); } else { hideStatus(); }
        });

        $(document).on('sb:change', function (e, reason) {
            if (drawer.open && drawer.mode === 'edit' && !SBData.mapping(drawer.mappingId)) { closeDrawer(); }
            if (reason === 'reset') { scrollToMin = 7 * 60; weekStart = startFor(U.today()); focusDate = U.today(); }
            render();
        });
    }

    return {
        init: function () {
            $scroller = $('#v2-scroller');
            $('#v2-backdrop, #v2-drawer').appendTo('body');
            bind();
            render();
        },
        onShow: function () { render(); }
    };
}(jQuery, SBUtil, SBRules));
