/* =====================================================================
 * view1.js – VIEW 1 "From / To"
 * Left: pick current assignments (browse a location or search a driver).
 * Right: set new location / type / timing per driver, Preview, Confirm.
 * ===================================================================== */
var SBView1 = (function ($, U, R) {
    'use strict';

    var $root;
    var mode = 'browse';
    var rows = {};        // mapping_id -> editable row { mapping_id, driver_id, location_id, shift_type, shift_start_time, shift_end_time }
    var order = [];       // mapping ids in the order they were selected
    var results = null;   // last preview: mapping_id -> { errors, warnings }
    var stale = true;     // true when rows changed since the last preview

    /* ---------- helpers ---------- */
    function typeBadge(type) {
        return '<span class="sb-badge ' + (type === 'Permanent' ? 'sb-badge-perm' : 'sb-badge-rel') + '">' + U.esc(type) + '</span>';
    }

    function emptyRow(cols, text) {
        return '<tr class="sb-empty-row"><td colspan="' + cols + '">' + U.esc(text) + '</td></tr>';
    }

    /* ---------- LEFT: selects ---------- */
    function fillCorporates() {
        var $c = $('#v1-corp'), cur = $c.val();
        var html = '<option value="">-- Select corporate --</option>';
        SBData.corporates().forEach(function (c) {
            html += '<option value="' + c.id + '">' + U.esc(c.corporatename) + '</option>';
        });
        $c.html(html).val(cur || '');

        var $b = $('#v1-b-corp'), bcur = $b.val();
        html = '<option value="">Keep current</option>';
        SBData.corporates().forEach(function (c) {
            html += '<option value="' + c.id + '">' + U.esc(c.corporatename) + '</option>';
        });
        $b.html(html).val(bcur || '');
    }

    function fillLocations() {
        var corp = $('#v1-corp').val(), $l = $('#v1-loc'), cur = $l.val();
        var html = '<option value="">' + (corp ? '-- Select location --' : '-- Select corporate first --') + '</option>';
        if (corp) {
            SBData.locations(corp).forEach(function (l) {
                html += '<option value="' + l.id + '">' + U.esc(l.location_title) + ' (' + SBData.mappingsAt(l.id).length + ')</option>';
            });
        }
        $l.html(html).prop('disabled', !corp);
        if (cur && $l.find('option[value="' + cur + '"]').length) { $l.val(cur); }
    }

    function fillBulkLocations() {
        var corp = $('#v1-b-corp').val(), $l = $('#v1-b-loc'), cur = $l.val();
        var html = '<option value="">Keep current</option>';
        if (corp) {
            SBData.locations(corp).forEach(function (l) {
                html += '<option value="' + l.id + '">' + U.esc(l.location_title) + '</option>';
            });
        }
        $l.html(html).prop('disabled', !corp);
        if (cur && $l.find('option[value="' + cur + '"]').length) { $l.val(cur); }
    }

    /* ---------- LEFT: table ---------- */
    function leftMappings() {
        if (mode === 'browse') {
            var loc = $('#v1-loc').val();
            return loc ? SBData.mappingsAt(loc) : null;
        }
        var q = $.trim($('#v1-q').val()).toLowerCase();
        if (!q) { return null; }
        return SBData.mappings().filter(function (m) {
            var d = SBData.driver(m.driver_id);
            return d && (d.full_name.toLowerCase().indexOf(q) > -1 || d.mobile_no.indexOf(q) > -1);
        });
    }

    function renderLeft() {
        var list = leftMappings(), $tb = $root.find('.v1-from-table tbody'), html = '';
        if (list === null) {
            html = emptyRow(4, mode === 'browse' ? 'Select a corporate and location to see its drivers.' : 'Type a driver name or mobile number.');
        } else if (!list.length) {
            html = emptyRow(4, mode === 'browse' ? 'No drivers are assigned to this location.' : 'No matching assignments found.');
        } else {
            list.sort(function (a, b) { return U.toMin(a.shift_start_time) - U.toMin(b.shift_start_time); });
            list.forEach(function (m) {
                var d = SBData.driver(m.driver_id), loc = SBData.location(m.location_id), corp = SBData.corporate(m.corporate_id);
                var sel = !!rows[m.id];
                html += '<tr class="v1-row' + (sel ? ' sb-selected' : '') + '" data-id="' + m.id + '">' +
                    '<td class="sb-col-check"><input type="checkbox" class="v1-chk"' + (sel ? ' checked' : '') + ' aria-label="Select ' + U.esc(d.full_name) + '"></td>' +
                    '<td><strong>' + U.esc(d.full_name) + '</strong><div class="sb-muted">' + U.esc(d.mobile_no) + '</div></td>' +
                    '<td>' + U.esc(corp.corporatename) + '<div class="sb-muted">' + U.esc(loc.location_title) + '</div></td>' +
                    '<td>' + typeBadge(m.shift_type) + '<div class="sb-time">' + U.esc(U.timeRange(m.shift_start_time, m.shift_end_time)) + '</div></td>' +
                    '</tr>';
            });
        }
        $tb.html(html);
        var n = list ? list.length : 0;
        $('#v1-info').text(n ? 'Showing 1 to ' + n + ' of ' + n + ' entries' : 'Showing 0 to 0 of 0 entries');
        syncSelectAll();
    }

    function syncSelectAll() {
        var $chk = $root.find('.v1-chk');
        var n = $chk.filter(':checked').length;
        $('#v1-all').prop('checked', $chk.length > 0 && n === $chk.length)
            .prop('indeterminate', n > 0 && n < $chk.length)
            .prop('disabled', !$chk.length);
    }

    /* ---------- selection ---------- */
    function select(id, on) {
        id = +id;
        if (on && !rows[id]) {
            var m = SBData.mapping(id);
            if (!m) { return; }
            rows[id] = U.toChange(m);
            order.push(id);
        } else if (!on && rows[id]) {
            delete rows[id];
            order = order.filter(function (x) { return x !== id; });
        }
        markStale();
    }

    function clearSelection() {
        rows = {};
        order = [];
        results = null;
        stale = true;
    }

    /* ---------- RIGHT: selected drivers table ---------- */
    function renderRight() {
        var $tb = $root.find('.v1-to-table tbody'), html = '';
        $('#v1-count').text(order.length);
        if (!order.length) {
            html = emptyRow(6, 'Select drivers on the left to plan their new assignment.');
        }
        order.forEach(function (id) {
            var r = rows[id], d = SBData.driver(r.driver_id), m = SBData.mapping(id);
            var res = (!stale && results) ? results[id] : null;
            var cls = res && res.errors.length ? ' sb-row-error' : (res && res.warnings.length ? ' sb-row-warning' : '');
            html += '<tr class="v1-sel-row' + cls + '" data-id="' + id + '">' +
                '<td><strong>' + U.esc(d.full_name) + '</strong><div class="sb-muted">' + U.esc(d.mobile_no) + '</div>' +
                    '<div class="sb-muted small v1-from-loc" title="Current: ' + U.esc(U.placeLabel(m.location_id)) + '"><i class="fa fa-map-marker"></i> ' + U.esc(SBData.location(m.location_id).location_title) + '</div></td>' +
                '<td><select class="form-control input-sm v1-f" data-f="location_id" aria-label="Location">' +
                    '<option value="">-- Select location --</option>' + U.locationOptions(r.location_id) + '</select></td>' +
                '<td><select class="form-control input-sm v1-f" data-f="shift_type" aria-label="Shift type">' +
                    '<option' + (r.shift_type === 'Permanent' ? ' selected' : '') + '>Permanent</option>' +
                    '<option' + (r.shift_type === 'Reliever' ? ' selected' : '') + '>Reliever</option></select></td>' +
                '<td><input type="time" step="900" class="form-control input-sm v1-f" data-f="shift_start_time" value="' + U.esc(r.shift_start_time) + '" aria-label="Start time"></td>' +
                '<td><input type="time" step="900" class="form-control input-sm v1-f" data-f="shift_end_time" value="' + U.esc(r.shift_end_time) + '" aria-label="End time"></td>' +
                '<td class="sb-col-icon"><a href="#" class="v1-remove sb-icon-btn" title="Remove from selection"><i class="fa fa-times"></i></a></td>' +
                '</tr>';
            if (res && (res.errors.length || res.warnings.length)) {
                html += '<tr class="v1-msg-row' + cls + '" data-for="' + id + '"><td colspan="6">' + R.messagesHtml(res) + '</td></tr>';
            }
        });
        $tb.html(html);
        renderSummary();
    }

    function renderSummary() {
        var text = '', cls = 'text-muted', ok = false;
        if (!order.length) {
            text = 'No drivers selected.';
        } else if (stale || !results) {
            text = 'Click Preview to check for conflicts.';
        } else {
            var errRows = 0, warnings = 0;
            order.forEach(function (id) {
                if (results[id].errors.length) { errRows++; }
                warnings += results[id].warnings.length;
            });
            if (errRows) {
                text = errRows + ' row(s) need fixing.'; cls = 'text-danger';
            } else if (warnings) {
                text = warnings + ' warning(s). Review before confirming.'; cls = 'text-warning'; ok = true;
            } else {
                text = 'No conflicts found.'; cls = 'text-success'; ok = true;
            }
        }
        $('#v1-summary').attr('class', 'v1-summary ' + cls).text(text);
        $('#v1-confirm').prop('disabled', !ok);
    }

    /* Rows changed: drop the old preview without re-rendering inputs. */
    function markStale() {
        stale = true;
        $root.find('.v1-msg-row').remove();
        $root.find('.v1-sel-row').removeClass('sb-row-error sb-row-warning');
        renderSummary();
    }

    function currentChanges() {
        return order.map(function (id) {
            var r = rows[id];
            return $.extend({}, r, { location_id: r.location_id ? +r.location_id : null });
        });
    }

    /* ---------- actions ---------- */
    function preview() {
        if (!order.length) { SBToast.show('Select at least one driver on the left first.', 'info'); return; }
        var changes = currentChanges(), res = R.validate(changes);
        results = {};
        order.forEach(function (id, i) { results[id] = res[i]; });
        stale = false;
        renderRight();
    }

    function applyBulk() {
        if (!order.length) { SBToast.show('Select drivers first, then apply defaults.', 'info'); return; }
        var corp = $('#v1-b-corp').val(), loc = $('#v1-b-loc').val(), type = $('#v1-b-type').val();
        var start = $('#v1-b-start').val(), end = $('#v1-b-end').val();
        if (!corp && !type && !start && !end) {
            SBToast.show('Choose at least one default (corporate, shift type or timing).', 'info');
            return;
        }
        order.forEach(function (id) {
            var r = rows[id];
            if (corp) {
                if (loc) {
                    r.location_id = +loc;
                } else {
                    // "Keep current" location only works if it belongs to the chosen corporate.
                    var cur = SBData.location(r.location_id);
                    if (!cur || cur.corporate_id !== +corp) { r.location_id = null; }
                }
            }
            if (type) { r.shift_type = type; }
            if (start) { r.shift_start_time = start; }
            if (end) { r.shift_end_time = end; }
        });
        stale = true;
        renderRight();
        SBToast.show('Defaults applied to ' + order.length + ' driver(s).', 'success');
    }

    function openConfirm() {
        var changes = currentChanges();
        $('#v1-modal-text').text('Update ' + changes.length + ' driver assignment(s)? Moving a driver removes them from the current location.');
        $('#v1-modal-list').html(changes.map(function (c) { return '<li>' + U.esc(R.describe(c)) + '</li>'; }).join(''));
        $('#v1-modal').modal('show');
    }

    function doConfirm() {
        var changes = currentChanges();
        // Final safety check – data may have changed in another view.
        var res = R.validate(changes);
        if (res.some(function (r) { return r.errors.length; })) {
            $('#v1-modal').modal('hide');
            preview();
            SBToast.show('Some rows have errors. Please fix them and preview again.', 'error');
            return;
        }
        var label = R.describeBatch(changes);
        clearSelection();               // clear first: applyChanges() triggers a re-render
        SBData.applyChanges(changes, label, 'View 1');
        $('#v1-modal').modal('hide');
        SBToast.show(label, 'success', changes.length + ' assignment(s) updated. ');
    }

    /* ---------- refresh after any data change ---------- */
    function refresh(reason) {
        if (reason === 'reset') {
            clearSelection();
        } else {
            // Drop selected rows whose mapping no longer exists.
            order = order.filter(function (id) {
                if (SBData.mapping(id)) { return true; }
                delete rows[id];
                return false;
            });
            stale = true;
        }
        fillCorporates();
        fillLocations();
        fillBulkLocations();
        renderLeft();
        renderRight();
    }

    /* ---------- events ---------- */
    function bind() {
        $root.on('click', '.v1-mode .btn', function () {
            mode = $(this).data('mode');
            $(this).addClass('active').siblings().removeClass('active');
            $root.find('.v1-browse').toggleClass('hidden', mode !== 'browse');
            $root.find('.v1-search').toggleClass('hidden', mode !== 'search');
            renderLeft();
            if (mode === 'search') { $('#v1-q').trigger('focus'); }
        });

        $('#v1-corp').on('change', function () { $('#v1-loc').val(''); fillLocations(); renderLeft(); });
        $('#v1-loc').on('change', renderLeft);
        $('#v1-q').on('input', renderLeft);

        // Row click toggles its checkbox
        $root.on('click', '.v1-row', function (e) {
            var $chk = $(this).find('.v1-chk');
            if (!$(e.target).is('.v1-chk')) { $chk.prop('checked', !$chk.prop('checked')); }
            select($(this).data('id'), $chk.prop('checked'));
            $(this).toggleClass('sb-selected', $chk.prop('checked'));
            syncSelectAll();
            renderRight();
        });

        $('#v1-all').on('change', function () {
            var on = $(this).prop('checked');
            $root.find('.v1-row').each(function () {
                $(this).toggleClass('sb-selected', on).find('.v1-chk').prop('checked', on);
                select($(this).data('id'), on);
            });
            renderRight();
        });

        // Inline edits on the right
        $root.on('change', '.v1-f', function () {
            var id = $(this).closest('tr').data('id'), f = $(this).data('f'), v = $(this).val();
            rows[id][f] = f === 'location_id' ? (v ? +v : null) : v;
            markStale();
        });

        $root.on('click', '.v1-remove', function (e) {
            e.preventDefault();
            var id = $(this).closest('tr').data('id');
            select(id, false);
            renderLeft();
            renderRight();
        });

        $('#v1-b-corp').on('change', function () { $('#v1-b-loc').val(''); fillBulkLocations(); });
        $('#v1-apply').on('click', applyBulk);
        $('#v1-preview').on('click', preview);
        $('#v1-confirm').on('click', openConfirm);
        $('#v1-modal-ok').on('click', doConfirm);
        $('#v1-reset').on('click', function () {
            clearSelection();
            $('#v1-b-corp, #v1-b-type').val('');
            $('#v1-b-start, #v1-b-end').val('');
            fillBulkLocations();
            renderLeft();
            renderRight();
            SBToast.show('Selection and edits cleared.', 'info');
        });

        $(document).on('sb:change', function (e, reason) { refresh(reason); });
    }

    return {
        init: function () {
            $root = $('#v1');
            $('#v1-modal').appendTo('body');   // keep the modal outside the tab pane
            bind();
            fillCorporates();
            // Start on a populated location so the demo opens with data.
            $('#v1-corp').val('1');
            fillLocations();
            $('#v1-loc').val('101');
            fillBulkLocations();
            renderLeft();
            renderRight();
        },
        onShow: function () { /* nothing size-dependent */ }
    };
}(jQuery, SBUtil, SBRules));
