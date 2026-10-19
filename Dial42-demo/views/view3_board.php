<!-- =====================================================================
     VIEW 3 – Driver Board (Kanban-style, driver-centric)
     Behaviour: assets/js/view3.js
     ===================================================================== -->
<div class="v3" id="v3">

    <!-- Left rail: unassigned drivers -->
    <div class="v3-rail">
        <div class="sb-card">
            <div class="sb-card-head"><i class="fa fa-user-plus"></i> Unassigned <span class="badge pull-right" id="v3-un-count">0</span></div>
            <div class="sb-card-body" id="v3-rail"></div>
        </div>
    </div>

    <div class="v3-main">
        <!-- Filter bar -->
        <div class="v3-filters">
            <div class="form-group">
                <label>Standby Corporate</label>
                <div class="dropdown">
                    <button type="button" class="btn btn-default btn-sm dropdown-toggle" id="v3-corp-btn" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                        <span>All corporates</span> <span class="caret"></span>
                    </button>
                    <div class="dropdown-menu v3-corp-menu" id="v3-corp-menu" aria-labelledby="v3-corp-btn"></div>
                </div>
            </div>
            <div class="form-group">
                <label>Shift</label>
                <div class="btn-group btn-group-sm" id="v3-shift" role="group" aria-label="Shift filter">
                    <button type="button" class="btn btn-default active" data-shift="all">All</button>
                    <button type="button" class="btn btn-default" data-shift="day" title="Starts 06:00 – 13:59">Day</button>
                    <button type="button" class="btn btn-default" data-shift="evening" title="Starts 14:00 – 21:59">Evening</button>
                    <button type="button" class="btn btn-default" data-shift="night" title="Starts 22:00 – 05:59">Night</button>
                </div>
            </div>
            <div class="form-group">
                <label for="v3-q">Driver</label>
                <input type="search" id="v3-q" class="form-control input-sm" placeholder="Name or mobile" autocomplete="off">
            </div>
            <div class="v3-hint hidden-xs"><i class="fa fa-hand-pointer-o"></i> Drag cards between locations · Ctrl/Shift-click to select several</div>
        </div>

        <!-- Board -->
        <div class="v3-board" id="v3-board"></div>

        <!-- Recent changes -->
        <div class="sb-card v3-log">
            <div class="sb-card-head"><i class="fa fa-history"></i> Recent changes <small class="sb-muted">(latest 10, from all views)</small></div>
            <div class="sb-card-body">
                <table class="table table-striped sb-table" style="border-bottom:0 !important">
                    <tbody id="v3-log"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>
