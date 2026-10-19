/* =====================================================================
 * view3.js – VIEW 3 "Driver Board"
 * Columns = locations grouped by corporate; cards = driver assignments.
 * Drag cards (or several with Ctrl/Shift-click) to another column, confirm
 * in a popover. Card menu: edit timing, change type, remove.
 * Unassigned drivers rail + "Recent changes" log with Undo.
 * ===================================================================== */
var SBView3 = (function ($, U, R) {
    'use strict';

    var corpFilter = null;    // { corporate_id: true } – null means "all"
    var shift = 'all';
    var query = '';
    var selected = {};        // mapping_id -> true
    var drag = null;
    var pop = null;           // open popover state

    /* ---------- filters ---------- */
    function corpOn(id) { return !corpFilter || !!corpFilter[id]; }

    function renderCorpMenu() {
        var corps = SBData.corporates(), on = corps.filter(function (c) { return corpOn(c.id); });
        var html = '<label><input type="checkbox" class="v3-corp-all"' + (on.length === corps.length ? ' checked' : '') + '> <b>All corporates</b></label><div class="divider"></div>';
        corps.forEach(function (c) {
            html += '<label><input type="checkbox" class="v3-corp-chk" value="' + c.id + '"' + (corpOn(c.id) ? ' checked' : '') + '> ' + U.esc(c.corporatename) + '</label>';
        });
        $('#v3-corp-menu').html(html);
        var text = on.length === corps.length ? 'All corporates (' + corps.length + ')' :
                   !on.length ? 'No corporate selected' : on.length === 1 ? on[0].corporatename : on.length + ' corporates';
        $('#v3-corp-btn > span:first').text(text);
    }

    function matches(m) {
        if (shift !== 'all' && U.bucket(m.shift_start_time) !== shift) { return false; }
        if (!query) { return true; }
        var d = SBData.driver(m.driver_id);
        return d.full_name.toLowerCase().indexOf(query) > -1 || d.mobile_no.indexOf(query) > -1;
    }

    /* ---------- coverage bar (24h, green = covered) ---------- */
    function coverage(locationId) {
        var segs = [];
        SBData.mappingsAt(locationId).forEach(function (m) { segs = segs.concat(U.segments(m.shift_start_time, m.shift_end_time)); });
        segs.sort(function (a, b) { return a[0] - b[0]; });
        var merged = [];
        segs.forEach(function (s) {
            var last = merged[merged.length - 1];
            if (last && s[0] <= last[1]) { last[1] = Math.max(last[1], s[1]); } else { merged.push([s[0], s[1]]); }
        });
        var covered = merged.reduce(function (t, s) { return t + s[1] - s[0]; }, 0);
        var bar = merged.map(function (s) {
            return '<span style="left:' + (s[0] / 14.4) + '%;width:' + ((s[1] - s[0]) / 14.4) + '%"></span>';
        }).join('');
        var gapH = (1440 - covered) / 60;
        var note = covered >= 1440 ? '<div class="v3-cov-note">24h covered</div>' :
            '<div class="v3-cov-note gap"><i class="fa fa-exclamation-circle"></i> ' + (Math.round(gapH * 10) / 10) + 'h not covered</div>';
        var tip = merged.length ? 'Covered: ' + merged.map(function (s) { return U.fmt(s[0]) + '–' + U.fmt(s[1], true); }).join(', ') : 'No coverage';
        return '<div class="v3-cov" title="' + U.esc(tip) + '">' + bar + '</div>' +
            '<div class="v3-cov-ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>' + note;
    }

    /* ---------- render ---------- */
    function cardHtml(m, warnings) {
        var d = SBData.driver(m.driver_id), w = warnings[m.id], perm = m.shift_type === 'Permanent';
        return '<div class="v3-card' + (perm ? '' : ' rel') + (w ? ' warn' : '') + (selected[m.id] ? ' selected' : '') + '" data-id="' + m.id + '">' +
            '<span class="sb-ini" style="background:' + U.color(d.full_name) + '">' + U.esc(U.initials(d.full_name)) + '</span>' +
            '<div class="info"><div class="nm" title="' + U.esc(d.full_name) + '">' + U.esc(d.full_name) + '</div>' +
            '<div class="mb">' + U.esc(d.mobile_no) + '</div>' +
            '<div class="meta"><span class="sb-badge ' + (perm ? 'sb-badge-perm' : 'sb-badge-rel') + '">' + U.esc(m.shift_type) + '</span>' +
            '<span class="v3-pill">' + U.esc(m.shift_start_time + '–' + m.shift_end_time) + '</span>' +
            (w ? '<i class="fa fa-exclamation-triangle v3-warn" title="' + U.esc(w.join('\n')) + '"></i>' : '') +
            '</div></div>' +
            '<a href="#" class="v3-menu-btn" title="Actions" aria-label="Actions for ' + U.esc(d.full_name) + '"><i class="fa fa-ellipsis-v"></i></a>' +
            '</div>';
    }

    function renderBoard() {
        var warnings = R.currentWarnings(), html = '';
        var corps = SBData.corporates().filter(function (c) { return corpOn(c.id); });

        // Forget selections that no longer exist.
        Object.keys(selected).forEach(function (id) { if (!SBData.mapping(id)) { delete selected[id]; } });

        if (!corps.length) {
            $('#v3-board').html('<div class="v2-empty"><i class="fa fa-filter fa-2x"></i><br>Select at least one corporate in the filter.</div>');
            return;
        }
        corps.forEach(function (c) {
            html += '<div class="v3-group"><div class="v3-group-head">' + U.esc(c.corporatename) + '<small>' + U.esc(c.companyname) + '</small></div><div class="v3-cols">';
            SBData.locations(c.id).forEach(function (l) {
                var all = SBData.mappingsAt(l.id);
                var shown = all.filter(matches).sort(function (a, b) { return U.toMin(a.shift_start_time) - U.toMin(b.shift_start_time); });
                html += '<div class="v3-col" data-loc="' + l.id + '">' +
                    '<div class="v3-col-head"><span class="c" title="Drivers at this location">' + all.length + '</span>' +
                    '<div class="t" title="' + U.esc(l.location_title + ' – ' + l.address1) + '">' + U.esc(l.location_title) + '</div>' +
                    coverage(l.id) + '</div><div class="v3-cards">' +
                    (shown.length ? shown.map(function (m) { return cardHtml(m, warnings); }).join('') :
                        '<div class="v3-col-empty">' + (all.length ? 'No drivers match the filter.' : 'No driver assigned.<br>Drag one here.') + '</div>') +
                    '</div></div>';
            });
            html += '</div></div>';
        });
        var left = $('#v3-board').scrollLeft();
        $('#v3-board').html('<div class="v3-board-inner">' + html + '</div>').scrollLeft(left);
    }

    function renderRail() {
        var list = SBData.unassignedDrivers();
        $('#v3-un-count').text(list.length);
        var shown = list.filter(function (d) { return !query || d.full_name.toLowerCase().indexOf(query) > -1 || d.mobile_no.indexOf(query) > -1; });
        var html = shown.map(function (d) {
            return '<div class="v3-un" data-driver="' + d.id + '" title="Drag onto a location">' +
                '<span class="sb-ini" style="background:' + U.color(d.full_name) + '">' + U.esc(U.initials(d.full_name)) + '</span>' +
                '<div><div class="nm">' + U.esc(d.full_name) + '</div><div class="sb-muted">' + U.esc(d.mobile_no) + '</div></div></div>';
        }).join('');
        if (!list.length) { html = '<div class="v3-col-empty">Every driver is assigned.</div>'; } else if (!shown.length) { html = '<div class="v3-col-empty">No match.</div>'; }
        $('#v3-rail').html(html + '<p class="v3-rail-note">Removed drivers land here. Drag a driver onto a location to assign.</p>');
    }

    function renderLog() {
        var log = SBData.recentChanges();
        if (!log.length) {
            $('#v3-log').html('<tr class="sb-empty-row"><td>No changes yet. Changes made in any of the three views appear here.</td></tr>');
            return;
        }
        $('#v3-log').html(log.map(function (e, i) {
            var t = e.time, hh = ('0' + t.getHours()).slice(-2), mm = ('0' + t.getMinutes()).slice(-2), ss = ('0' + t.getSeconds()).slice(-2);
            return '<tr><td class="when">' + hh + ':' + mm + ':' + ss + '</td>' +
                '<td class="src"><span class="sb-src">' + U.esc(e.source) + '</span></td>' +
                '<td>' + U.esc(e.label) + '</td>' +
                '<td style="width:80px;text-align:right">' + (i === 0 ? '<button type="button" class="btn btn-default btn-xs v3-undo"><i class="fa fa-undo"></i> Undo</button>' : '') + '</td></tr>';
        }).join(''));
    }

    function render() {
        if (drag) { return; }
        renderCorpMenu();
        renderBoard();
        renderRail();
        renderLog();
    }

    function flash(ids) {
        ids.forEach(function (id) { $('#v3-board .v3-card[data-id="' + id + '"]').addClass('flash'); });
    }

    /* ---------- popover (move / assign / edit) ---------- */
    function closePop() { $('#v3-pop').remove(); pop = null; }
    function closeMenu() { $('#v3-menu').remove(); }

    function place($el, x, y) {
        var w = $el.outerWidth(), h = $el.outerHeight();
        $el.css({ left: Math.max(10, Math.min(x + 12, window.innerWidth - w - 10)), top: Math.max(10, Math.min(y + 12, window.innerHeight - h - 10)) });
    }

    /* items: [{ mapping_id|null, driver_id, location_id (target), shift_type, shift_start_time, shift_end_time }] */
    function openPop(opts) {
        closePop();
        closeMenu();
        pop = $.extend({ ack: false }, opts);
        var body = pop.items.map(function (c, i) {
            var orig = c.mapping_id ? SBData.mapping(c.mapping_id) : null, d = SBData.driver(c.driver_id);
            var route = (orig && orig.location_id !== c.location_id) ?
                U.esc(U.placeLabel(orig.location_id)) + '<i class="fa fa-long-arrow-right"></i><b>' + U.esc(U.placeLabel(c.location_id)) + '</b>' :
                (orig ? U.esc(U.placeLabel(c.location_id)) : '<i class="fa fa-long-arrow-right"></i><b>' + U.esc(U.placeLabel(c.location_id)) + '</b>');
            return '<div class="sb-pop-item" data-i="' + i + '">' +
                '<div class="sb-pop-route"><b>' + U.esc(d.full_name) + '</b> · ' + route + '</div>' +
                '<div class="sb-pop-fields">' +
                '<select class="form-control input-sm" data-f="shift_type" aria-label="Shift type"><option' + (c.shift_type === 'Permanent' ? ' selected' : '') + '>Permanent</option><option' + (c.shift_type === 'Reliever' ? ' selected' : '') + '>Reliever</option></select>' +
                '<input type="time" step="900" class="form-control input-sm" data-f="shift_start_time" value="' + U.esc(c.shift_start_time) + '" aria-label="Start time">' +
                '<input type="time" step="900" class="form-control input-sm" data-f="shift_end_time" value="' + U.esc(c.shift_end_time) + '" aria-label="End time">' +
                '</div><div class="sb-pop-msgs"></div></div>';
        }).join('');
        var $p = $('<div class="sb-pop" id="v3-pop" role="dialog" aria-label="' + U.esc(pop.title) + '">' +
            '<div class="sb-pop-head">' + U.esc(pop.title) + '<button type="button" class="close v3-pop-cancel" aria-label="Close">&times;</button></div>' +
            '<div class="sb-pop-body">' + body + '</div>' +
            '<div class="sb-pop-foot"><button type="button" class="btn btn-default btn-sm v3-pop-cancel">Cancel</button>' +
            '<button type="button" class="btn btn-primary btn-sm v3-pop-ok">' + U.esc(pop.okText) + '</button></div></div>').appendTo('body');
        place($p, pop.x, pop.y);
        if (pop.preValidate) { validatePop(); }
        $p.find(pop.focus || 'input').first().trigger('focus');
    }

    function popChanges() {
        return pop.items.map(function (c, i) {
            var $it = $('#v3-pop .sb-pop-item[data-i="' + i + '"]');
            return $.extend({}, c, {
                shift_type: $it.find('[data-f="shift_type"]').val(),
                shift_start_time: $it.find('[data-f="shift_start_time"]').val(),
                shift_end_time: $it.find('[data-f="shift_end_time"]').val()
            });
        });
    }

    /* Show messages; returns { changes, res, errors, warnings }. */
    function validatePop() {
        var changes = popChanges(), res = R.validate(changes), errors = 0, warnings = 0;
        res.forEach(function (r, i) {
            errors += r.errors.length;
            warnings += r.warnings.length;
            $('#v3-pop .sb-pop-item[data-i="' + i + '"] .sb-pop-msgs').html(R.messagesHtml(r));
        });
        if (warnings && !errors) {
            pop.ack = true;
            $('#v3-pop .v3-pop-ok').text(pop.okText + ' anyway');
        }
        return { changes: changes, errors: errors, warnings: warnings };
    }

    function popOk() {
        var wasAck = pop.ack, v = validatePop();
        if (v.errors) { return; }
        if (v.warnings && !wasAck) { return; }   // first click shows warnings, second click saves
        var label = R.describeBatch(v.changes), title = pop.toastTitle || 'Saved. ';
        SBData.applyChanges(v.changes, label, 'View 3');
        var ids = v.changes.map(function (c) { return c.mapping_id; }).filter(Boolean);
        if (!ids.length) { ids = [SBData.mappings().slice(-1)[0].id]; }
        selected = {};
        closePop();
        render();
        flash(ids);
        SBToast.show(label, v.warnings ? 'warning' : 'success', v.warnings ? 'Saved with warning. ' : title);
    }

    /* ---------- card actions ---------- */
    function openMenu(id, btn) {
        closeMenu();
        var m = SBData.mapping(id), other = m.shift_type === 'Permanent' ? 'Reliever' : 'Permanent';
        var r = btn.getBoundingClientRect();
        var $m = $('<ul class="sb-menu" id="v3-menu" role="menu" data-id="' + id + '">' +
            '<li><a href="#" data-act="time" role="menuitem"><i class="fa fa-clock-o"></i> Edit timing</a></li>' +
            '<li><a href="#" data-act="type" role="menuitem"><i class="fa fa-exchange"></i> Change to ' + other + '</a></li>' +
            '<li><a href="#" data-act="remove" class="danger" role="menuitem"><i class="fa fa-trash"></i> Remove from location</a></li></ul>').appendTo('body');
        $m.css({ left: Math.max(10, Math.min(r.right - $m.outerWidth(), window.innerWidth - $m.outerWidth() - 10)), top: Math.min(r.bottom + 2, window.innerHeight - $m.outerHeight() - 10) });
    }

    function menuAction(act, id, x, y) {
        var m = SBData.mapping(id);
        closeMenu();
        if (!m) { return; }
        var name = R.driverName(m.driver_id);
        if (act === 'time') {
            openPop({ title: 'Edit timing – ' + name, okText: 'Save', items: [U.toChange(m)], x: x, y: y, focus: '[data-f="shift_start_time"]' });
        } else if (act === 'type') {
            var change = $.extend(U.toChange(m), { shift_type: m.shift_type === 'Permanent' ? 'Reliever' : 'Permanent' });
            var res = R.validate([change])[0];
            if (res.errors.length) { SBToast.show(res.errors[0], 'error', 'Not saved. '); return; }
            if (res.warnings.length) {
                // Let the user review the warning before changing.
                openPop({ title: 'Change type – ' + name, okText: 'Change', items: [change], x: x, y: y, preValidate: true, focus: 'select' });
                return;
            }
            var label = R.describe(change);
            SBData.applyChanges([change], label, 'View 3');
            flash([id]);
            SBToast.show(label, 'success', 'Saved. ');
        } else if (act === 'remove') {
            var lbl = 'Removed ' + name + ' from ' + U.placeLabel(m.location_id);
            SBData.removeMapping(id, lbl, 'View 3');
            SBToast.show(lbl + '. Use Undo in "Recent changes" to restore.', 'success', 'Removed. ');
        }
    }

    /* ---------- drag & drop (pointer events) ---------- */
    function colUnder(x, y) {
        var el = document.elementFromPoint(x, y);
        return el ? $(el).closest('.v3-col')[0] || null : null;
    }

    function onDown(e) {
        if (e.button !== 0 || $(e.target).closest('.v3-menu-btn').length) { return; }
        var $el = $(this);
        drag = {
            el: this, isCard: $el.hasClass('v3-card'), id: +$el.data('id'), driver: +$el.data('driver'),
            x0: e.clientX, y0: e.clientY, moved: false, mod: e.ctrlKey || e.shiftKey || e.metaKey, $ghost: null, ids: []
        };
        try { this.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        e.preventDefault();
    }

    function onMove(e) {
        if (!drag) { return; }
        if (!drag.moved && Math.abs(e.clientX - drag.x0) < 5 && Math.abs(e.clientY - drag.y0) < 5) { return; }
        if (!drag.moved) {
            drag.moved = true;
            closeMenu();
            closePop();
            if (drag.isCard) {
                if (!selected[drag.id]) { selected = {}; selected[drag.id] = true; $('#v3-board .v3-card.selected').removeClass('selected'); $(drag.el).addClass('selected'); }
                drag.ids = Object.keys(selected).map(Number);
                drag.ids.forEach(function (id) { $('#v3-board .v3-card[data-id="' + id + '"]').addClass('dragging-src'); });
            }
            drag.$ghost = $(drag.el).clone().removeClass('dragging-src selected flash').addClass('sb-drag-ghost').css('width', $(drag.el).outerWidth()).appendTo('body');
            if (drag.ids.length > 1) { drag.$ghost.append('<span class="v3-ghost-count">' + drag.ids.length + '</span>'); }
        }
        drag.$ghost.css({ left: e.clientX - 30, top: e.clientY - 20 });
        var col = colUnder(e.clientX, e.clientY);
        $('#v3-board .drop-hover').removeClass('drop-hover');
        if (col) { $(col).addClass('drop-hover'); }

        // Auto-scroll the board horizontally near its edges
        var b = $('#v3-board')[0], r = b.getBoundingClientRect();
        if (e.clientX > r.right - 40) { b.scrollLeft += 16; } else if (e.clientX < r.left + 40) { b.scrollLeft -= 16; }
    }

    function onUp(e) {
        if (!drag) { return; }
        var d = drag;
        drag = null;
        if (d.$ghost) { d.$ghost.remove(); }
        $('#v3-board .drop-hover').removeClass('drop-hover');
        $('#v3-board .dragging-src').removeClass('dragging-src');

        if (!d.moved) {   // plain click / ctrl-click = selection
            if (!d.isCard) { SBToast.show('Drag the driver onto a location column to assign.', 'info'); return; }
            if (d.mod) {
                if (selected[d.id]) { delete selected[d.id]; } else { selected[d.id] = true; }
            } else {
                var only = selected[d.id] && Object.keys(selected).length === 1;
                selected = {};
                if (!only) { selected[d.id] = true; }
            }
            $('#v3-board .v3-card').each(function () { $(this).toggleClass('selected', !!selected[$(this).data('id')]); });
            return;
        }

        var col = colUnder(e.clientX, e.clientY);
        if (!col) { return; }
        var loc = +$(col).data('loc'), place = U.placeLabel(loc);

        if (!d.isCard) {
            openPop({
                title: 'Assign driver → ' + SBData.location(loc).location_title, okText: 'Assign', x: e.clientX, y: e.clientY,
                toastTitle: 'Assigned. ',
                items: [{ mapping_id: null, driver_id: d.driver, location_id: loc, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' }]
            });
            return;
        }
        var items = d.ids.map(function (id) { return SBData.mapping(id); })
            .filter(function (m) { return m && m.location_id !== loc; })
            .map(function (m) { return $.extend(U.toChange(m), { location_id: loc }); });
        if (!items.length) { return; }   // dropped back on its own column
        openPop({
            title: 'Move ' + items.length + ' assignment' + (items.length > 1 ? 's' : '') + ' → ' + place, okText: 'Move',
            x: e.clientX, y: e.clientY, items: items, toastTitle: 'Moved. '
        });
    }

    /* ---------- events ---------- */
    function bind() {
        var $v = $('#v3');

        // Corporate multi-select (keep dropdown open while ticking)
        $('#v3-corp-menu').on('click', function (e) { e.stopPropagation(); })
            .on('change', 'input', function () {
                if ($(this).hasClass('v3-corp-all')) {
                    corpFilter = $(this).prop('checked') ? null : {};
                } else {
                    corpFilter = {};
                    $('#v3-corp-menu .v3-corp-chk:checked').each(function () { corpFilter[$(this).val()] = true; });
                    if (Object.keys(corpFilter).length === SBData.corporates().length) { corpFilter = null; }
                }
                renderCorpMenu();
                renderBoard();
            });

        $('#v3-shift').on('click', '.btn', function () {
            shift = $(this).data('shift');
            $(this).addClass('active').siblings().removeClass('active');
            renderBoard();
        });
        $('#v3-q').on('input', function () { query = $.trim($(this).val()).toLowerCase(); renderBoard(); renderRail(); });

        $v.on('pointerdown', '.v3-card, .v3-un', onDown)
          .on('pointermove', '.v3-card, .v3-un', onMove)
          .on('pointerup pointercancel', '.v3-card, .v3-un', onUp);

        // Card menu
        $v.on('click', '.v3-menu-btn', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var id = $(this).closest('.v3-card').data('id');
            if ($('#v3-menu').data('id') === id) { closeMenu(); return; }
            openMenu(id, this);
        });
        $(document).on('click', '#v3-menu a', function (e) {
            e.preventDefault();
            var r = $('#v3-menu')[0].getBoundingClientRect();
            menuAction($(this).data('act'), $('#v3-menu').data('id'), r.left, r.top);
        });

        // Popover
        $(document).on('click', '#v3-pop .v3-pop-cancel', closePop);
        $(document).on('click', '#v3-pop .v3-pop-ok', popOk);
        $(document).on('change input', '#v3-pop [data-f]', function () {
            if (!pop) { return; }
            pop.ack = false;
            $('#v3-pop .v3-pop-ok').text(pop.okText);
            $('#v3-pop .sb-pop-msgs').empty();
        });

        // Outside click closes menu / popover; Escape closes and clears selection
        $(document).on('pointerdown', function (e) {
            if (!$(e.target).closest('#v3-menu, .v3-menu-btn').length) { closeMenu(); }
            if (pop && !$(e.target).closest('#v3-pop').length && !$(e.target).closest('.v3-card, .v3-un').length) { closePop(); }
        });
        $(document).on('keydown', function (e) {
            if (e.key !== 'Escape') { return; }
            if (pop || $('#v3-menu').length) { closePop(); closeMenu(); return; }
            if ($('#v3').is(':visible') && Object.keys(selected).length) { selected = {}; $('#v3-board .v3-card.selected').removeClass('selected'); }
        });
        $('#v3-board').on('scroll', closeMenu);

        // Undo
        $v.on('click', '.v3-undo', function () {
            var entry = SBData.undo();
            if (entry) { SBToast.show(entry.label, 'info', 'Undone: '); }
        });

        $(document).on('sb:change', function (e, reason) {
            if (reason === 'reset') { selected = {}; closePop(); closeMenu(); }
            render();
        });
    }

    return {
        init: function () { bind(); render(); },
        onShow: function () { closePop(); closeMenu(); render(); }
    };
}(jQuery, SBUtil, SBRules));
