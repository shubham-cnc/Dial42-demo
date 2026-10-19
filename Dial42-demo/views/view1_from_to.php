<!-- =====================================================================
     VIEW 1 – From / To (replica of production "StandBy > Update Schedule")
     Behaviour: assets/js/view1.js
     ===================================================================== -->
<div class="row v1" id="v1">

    <!-- ---------- LEFT: From – current assignment ---------- -->
    <div class="col-lg-5">
        <div class="sb-card">
            <div class="sb-card-head"><i class="fa fa-sign-out"></i> From – current assignment</div>
            <div class="sb-card-body">
                <div class="btn-group btn-group-sm v1-mode" role="group" aria-label="Find drivers by">
                    <button type="button" class="btn btn-default active" data-mode="browse"><i class="fa fa-map-marker"></i> Browse location</button>
                    <button type="button" class="btn btn-default" data-mode="search"><i class="fa fa-search"></i> Search driver</button>
                </div>

                <div class="v1-browse row sb-form-row">
                    <div class="col-sm-6 form-group">
                        <label for="v1-corp">Corporate</label>
                        <select id="v1-corp" class="form-control input-sm"></select>
                    </div>
                    <div class="col-sm-6 form-group">
                        <label for="v1-loc">Location</label>
                        <select id="v1-loc" class="form-control input-sm"></select>
                    </div>
                </div>

                <div class="v1-search sb-form-row hidden">
                    <div class="form-group">
                        <label for="v1-q">Driver name or mobile</label>
                        <div class="input-group input-group-sm">
                            <span class="input-group-addon"><i class="fa fa-search"></i></span>
                            <input type="text" id="v1-q" class="form-control" placeholder="e.g. Chinmay or 98332" autocomplete="off">
                        </div>
                    </div>
                </div>

                <div class="table-responsive">
                    <table class="table table-bordered table-striped sb-table v1-from-table">
                        <thead>
                            <tr>
                                <th class="sb-col-check"><input type="checkbox" id="v1-all" title="Select all"></th>
                                <th>Driver</th>
                                <th>Assignment</th>
                                <th>Shift</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
                <div class="sb-dt-info" id="v1-info"></div>
            </div>
        </div>
    </div>

    <!-- ---------- RIGHT: To – new assignment ---------- -->
    <div class="col-lg-7">
        <div class="sb-card">
            <div class="sb-card-head"><i class="fa fa-sign-in"></i> To – new assignment</div>
            <div class="sb-card-body">

                <div class="v1-bulk">
                    <div class="v1-bulk-title">Bulk defaults <small>(applied to every selected driver)</small></div>
                    <div class="row sb-form-row">
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label for="v1-b-corp">Corporate</label>
                            <select id="v1-b-corp" class="form-control input-sm"></select>
                        </div>
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label for="v1-b-loc">Location</label>
                            <select id="v1-b-loc" class="form-control input-sm"></select>
                        </div>
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label for="v1-b-type">Shift type</label>
                            <select id="v1-b-type" class="form-control input-sm">
                                <option value="">Keep current</option>
                                <option>Permanent</option>
                                <option>Reliever</option>
                            </select>
                        </div>
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label for="v1-b-start">Start time</label>
                            <input type="time" id="v1-b-start" class="form-control input-sm" step="900">
                        </div>
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label for="v1-b-end">End time</label>
                            <input type="time" id="v1-b-end" class="form-control input-sm" step="900">
                        </div>
                        <div class="col-sm-4 col-xs-6 form-group">
                            <label class="hidden-xs">&nbsp;</label>
                            <button type="button" id="v1-apply" class="btn btn-default btn-sm btn-block"><i class="fa fa-magic"></i> Apply to all</button>
                        </div>
                    </div>
                </div>

                <h4 class="v1-sel-title">Selected drivers <span class="badge" id="v1-count">0</span></h4>
                <div class="table-responsive">
                    <table class="table table-bordered sb-table v1-to-table">
                        <thead>
                            <tr>
                                <th style="min-width:130px">Driver</th>
                                <th style="min-width:160px">Location</th>
                                <th style="min-width:108px">Shift type</th>
                                <th style="min-width:100px">Start</th>
                                <th style="min-width:100px">End</th>
                                <th class="sb-col-icon"></th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>

                <div class="v1-actions">
                    <button type="button" id="v1-preview" class="btn btn-primary btn-sm"><i class="fa fa-eye"></i> Preview</button>
                    <button type="button" id="v1-confirm" class="btn btn-success btn-sm" disabled><i class="fa fa-check"></i> Confirm</button>
                    <button type="button" id="v1-reset" class="btn btn-default btn-sm"><i class="fa fa-undo"></i> Reset</button>
                    <span class="v1-summary text-muted" id="v1-summary"></span>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Confirm modal -->
<div class="modal fade" id="v1-modal" tabindex="-1" role="dialog" aria-labelledby="v1-modal-title">
    <div class="modal-dialog" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>
                <h4 class="modal-title" id="v1-modal-title">Confirm update</h4>
            </div>
            <div class="modal-body">
                <p id="v1-modal-text"></p>
                <ul id="v1-modal-list" class="v1-modal-list"></ul>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default btn-sm" data-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="v1-modal-ok"><i class="fa fa-check"></i> OK, update</button>
            </div>
        </div>
    </div>
</div>
