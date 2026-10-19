<!-- =====================================================================
     VIEW 2 – Calendar / scheduler grid (one corporate at a time)
     Behaviour: assets/js/view2.js
     ===================================================================== -->
<div class="v2" id="v2">
    <div class="v2-toolbar">
        <div class="form-group">
            <label for="v2-corp">Standby Corporate</label>
            <select id="v2-corp" class="form-control input-sm"></select>
        </div>
        <div class="form-group">
            <label for="v2-company">Standby Company</label>
            <input type="text" id="v2-company" class="form-control input-sm" readonly>
        </div>
        <div class="v2-legend" aria-label="Legend">
            <span><i class="lg-perm"></i>Permanent</span>
            <span><i class="lg-rel"></i>Reliever</span>
            <span><i class="lg-conf"></i>Conflict</span>
        </div>
        <div class="v2-zoom">
            <label class="hidden-xs" style="display:block">Slot size</label>
            <div class="btn-group btn-group-sm" role="group" aria-label="Zoom">
                <button type="button" class="btn btn-default active" data-zoom="30">30 min</button>
                <button type="button" class="btn btn-default" data-zoom="60">1 hr</button>
                <button type="button" class="btn btn-default" data-zoom="240">4 hr</button>
            </div>
        </div>
    </div>

    <!-- 7-day date navigator -->
    <div class="v2-datenav">
        <div class="btn-group btn-group-sm v2-viewmode" role="group" aria-label="Layout">
            <button type="button" class="btn btn-default active" data-viewmode="week" aria-pressed="true" title="One location, 7 days"><i class="fa fa-calendar"></i> Week <span class="hidden-xs">· one location</span></button>
            <button type="button" class="btn btn-default" data-viewmode="day" aria-pressed="false" title="One day, all locations"><i class="fa fa-columns"></i> Day <span class="hidden-xs">· all locations</span></button>
        </div>
        <div class="btn-group btn-group-sm" role="group" aria-label="Week">
            <button type="button" class="btn btn-default" data-nav="-7" title="Previous week"><i class="fa fa-chevron-left"></i> Previous week</button>
            <button type="button" class="btn btn-default" data-nav="today">Today</button>
            <button type="button" class="btn btn-default" data-nav="7" title="Next week">Next week <i class="fa fa-chevron-right"></i></button>
        </div>
        <div class="btn-group btn-group-sm v2-weekstart" role="group" aria-label="Week starts on">
            <button type="button" class="btn btn-default active" data-weekstart="monday" aria-pressed="true" title="Show weeks from Monday to Sunday">Mon – Sun</button>
            <button type="button" class="btn btn-default" data-weekstart="today" aria-pressed="false" title="Show 7 days starting from today">From today</button>
        </div>
        <input type="date" id="v2-jump" class="form-control input-sm" aria-label="Jump to date" title="Jump to date">
        <strong class="v2-range" id="v2-range"></strong>
        <div class="btn-group btn-group-sm v2-colmode" role="group" aria-label="Location columns">
            <button type="button" class="btn btn-default active" data-colmode="legend" aria-pressed="true" title="Short columns: locations shown as letters (see legend)"><i class="fa fa-tags"></i> Legend</button>
            <button type="button" class="btn btn-default" data-colmode="names" aria-pressed="false" title="Wider columns with the full location name"><i class="fa fa-map-marker"></i> Location names</button>
        </div>
        <div class="v2-legend v2-loc-legend" id="v2-loc-legend" aria-label="Locations"></div>
    </div>

    <!-- tabs: locations (week view) or dates (day view); click to switch, drop a shift to move it -->

    <div class="v2-strip" id="v2-strip" role="toolbar" aria-label="Switch location or day"></div>


    <!-- status bar: "Saved" / "Removed" confirmations with Undo (errors and warnings open a centred pop-up) -->
    <div class="v2-status" id="v2-status" role="status" aria-live="polite" style="display:none"></div>

    <!-- grid is rendered here -->
    <div class="v2-scroller" id="v2-scroller"></div>

    <!-- unassigned drivers (drag onto the grid) -->
    <div class="v2-unassigned" id="v2-unassigned">
        <div class="v2-un-head">
            <strong><i class="fa fa-user-plus"></i> Unassigned drivers</strong>
            <div class="v2-un-search">
                <i class="fa fa-search"></i>
                <input type="text" id="v2-un-q" class="form-control input-sm" placeholder="Search name or mobile" autocomplete="off">
            </div>
        </div>
        <div class="v2-un-list" id="v2-un-list"></div>
    </div>
</div>

<!-- Right-side drawer: edit / assign -->
<div class="sb-drawer-backdrop" id="v2-backdrop"></div>
<div class="sb-drawer" id="v2-drawer" role="dialog" aria-labelledby="v2-d-title" aria-hidden="true">
    <div class="sb-drawer-head">
        <button type="button" class="close v2-d-cancel" aria-label="Close"><span aria-hidden="true">&times;</span></button>
        <h2 id="v2-d-title">Edit assignment</h2>
    </div>
    <div class="sb-drawer-body">
        <div id="v2-d-info"></div>

        <div class="form-group">
            <label for="v2-d-driver">Standby Driver *</label>
            <select id="v2-d-driver" class="form-control input-sm v2-d-f"></select>
        </div>
        <div class="form-group">
            <label for="v2-d-corp">Standby Corporate *</label>
            <select id="v2-d-corp" class="form-control input-sm v2-d-f"></select>
        </div>
        <div class="form-group">
            <label for="v2-d-loc">Location *</label>
            <select id="v2-d-loc" class="form-control input-sm v2-d-f"></select>
        </div>
        <div class="form-group">
            <label for="v2-d-type">Shift Type *</label>
            <select id="v2-d-type" class="form-control input-sm v2-d-f">
                <option>Permanent</option>
                <option>Reliever</option>
            </select>
        </div>

        <h4 class="sb-sub-h">Select Shift Timing</h4>
        <div class="form-group v2-d-scope" id="v2-d-scope">
            <label>This shift repeats daily (<span id="v2-d-scope-range"></span>). Apply changes to:</label>
            <div class="radio"><label><input type="radio" name="v2-d-scope" value="one" checked> Only this day – <span id="v2-d-scope-day"></span></label></div>
            <div class="radio"><label><input type="radio" name="v2-d-scope" value="all"> All days</label></div>
        </div>
        <div class="row">
            <div class="col-xs-6 form-group">
                <label for="v2-d-date">From date *</label>
                <input type="date" id="v2-d-date" class="form-control input-sm v2-d-f">
            </div>
            <div class="col-xs-6 form-group">
                <label for="v2-d-to">To date</label>
                <input type="date" id="v2-d-to" class="form-control input-sm v2-d-f">
            </div>
        </div>
        <p class="sb-muted" style="margin-top:-6px"><i class="fa fa-repeat"></i> Set a later To date to repeat this slot every day.</p>
        <div class="row">
            <div class="col-xs-6 form-group">
                <label for="v2-d-start">Shift Start Time *</label>
                <input type="time" id="v2-d-start" class="form-control input-sm v2-d-f" step="900">
            </div>
            <div class="col-xs-6 form-group">
                <label for="v2-d-end">Shift End Time *</label>
                <input type="time" id="v2-d-end" class="form-control input-sm v2-d-f" step="900">
            </div>
        </div>
        <p class="sb-muted"><i class="fa fa-info-circle"></i> An end time earlier than the start time means the shift runs past midnight.</p>
        <div class="sb-msg-box" id="v2-d-msgs"></div>
    </div>
    <div class="sb-drawer-foot">
        <button type="button" class="btn btn-primary btn-sm" id="v2-d-save"><i class="fa fa-check"></i> <span>Save</span></button>
        <button type="button" class="btn btn-default btn-sm v2-d-cancel">Cancel</button>
        <button type="button" class="btn btn-danger btn-sm" id="v2-d-remove"><i class="fa fa-trash"></i> <span>Remove from location</span></button>
    </div>
</div>
