<?php
/* ---------------------------------------------------------------------
 * StandBy Corporate – Update Schedule (UI demo)
 * Page shell: sidebar + top nav + 3 alternative views in tabs.
 * PHP is only used for includes – there is no database or API.
 * ------------------------------------------------------------------- */
$pageTitle = 'Update Schedule';
// Asset URL with the file's modified time, so edits are never hidden by the browser cache.
function asset($path) { return $path . '?v=' . @filemtime(__DIR__ . '/' . $path); }
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo htmlspecialchars($pageTitle); ?> | StandBy Corporate</title>

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
    <link rel="stylesheet" href="<?php echo asset('assets/css/demo.css'); ?>">
</head>
<body class="nav-md">
<div class="main_container">

    <?php include __DIR__ . '/partials/sidebar.php'; ?>
    <?php include __DIR__ . '/partials/header.php'; ?>

    <!-- page content -->
    <div class="right_col" role="main">
        <div class="page-title">
            <h3><?php echo htmlspecialchars($pageTitle); ?></h3>
            <span class="page-sub">StandBy Corporate &rsaquo; manage driver location assignment and shift timing</span>
        </div>

        <div class="x_panel">
            <ul class="nav nav-tabs sb-view-tabs" role="tablist">
                <li role="presentation"><a href="#view1" data-view="view1" role="tab" data-toggle="tab"><i class="fa fa-exchange"></i> View 1 – From / To</a></li>
                <li role="presentation"><a href="#view2" data-view="view2" role="tab" data-toggle="tab"><i class="fa fa-calendar"></i> View 2 – Calendar</a></li>
                <li role="presentation"><a href="#view3" data-view="view3" role="tab" data-toggle="tab"><i class="fa fa-columns"></i> View 3 – Driver Board</a></li>
            </ul>

            <div class="tab-content">
                <div role="tabpanel" class="tab-pane" id="view1">
                    <p class="sb-view-desc"><i class="fa fa-lightbulb-o"></i> Today's screen, cleaned up: pick drivers on the left, set their new location and timing on the right, preview conflicts, then confirm in one batch.</p>
                    <?php include __DIR__ . '/views/view1_from_to.php'; ?>
                </div>
                <div role="tabpanel" class="tab-pane" id="view2">
                    <p class="sb-view-desc"><i class="fa fa-lightbulb-o"></i> <b>Week</b> shows one location over 7 days, <b>Day</b> shows every location on one day. Drag blocks to change date, timing or location (or drop them on a tab), drag an edge to set an 8-hour slot, and click any slot to assign a driver.</p>
                    <?php include __DIR__ . '/views/view2_calendar.php'; ?>
                </div>
                <div role="tabpanel" class="tab-pane" id="view3">
                    <p class="sb-view-desc"><i class="fa fa-lightbulb-o"></i> Driver-first Kanban board across all corporates: drag driver cards between locations, see 24h coverage gaps at a glance, and undo mistakes.</p>
                    <?php include __DIR__ . '/views/view3_board.php'; ?>
                </div>
            </div>
        </div>
    </div>
    <!-- /page content -->

    <footer class="sb-footer">StandBy Corporate – UI demo · sample data only, nothing is saved to a server</footer>
</div>

<div id="sb-toasts" aria-live="polite"></div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/twitter-bootstrap/3.3.7/js/bootstrap.min.js"></script>
<script src="<?php echo asset('assets/js/data.js'); ?>"></script>
<script src="<?php echo asset('assets/js/rules.js'); ?>"></script>
<script src="<?php echo asset('assets/js/view1.js'); ?>"></script>
<script src="<?php echo asset('assets/js/view2.js'); ?>"></script>
<script src="<?php echo asset('assets/js/view3.js'); ?>"></script>
<script>
/* ---------- Page shell: tabs, sidebar toggle, reset ---------- */
jQuery(function ($) {
    'use strict';
    var TAB_KEY = 'standbyDemo.lastTab';
    var views = { view1: SBView1, view2: SBView2, view3: SBView3 };

    function store(key, val) {
        try { if (val === undefined) { return localStorage.getItem(key); } localStorage.setItem(key, val); } catch (e) { return null; }
        return null;
    }

    // Build every view once; each re-renders itself on "sb:change".
    $.each(views, function (k, v) { v.init(); });

    // Re-render the view that becomes visible (layout may depend on size).
    $('.sb-view-tabs a').on('shown.bs.tab', function () {
        var key = $(this).data('view');
        store(TAB_KEY, key);
        views[key].onShow();
    });

    var last = store(TAB_KEY);
    if (!views[last]) { last = 'view1'; }
    $('.sb-view-tabs a[data-view="' + last + '"]').tab('show');

    // Reset demo data
    $('#sb-reset').on('click', function (e) {
        e.preventDefault();
        SBData.reset();
        SBToast.show('Original sample data restored.', 'info', 'Demo reset. ');
    });

    // Sidebar collapse (hamburger)
    $('#menu_toggle').on('click', function (e) {
        e.preventDefault();
        $('body').toggleClass('nav-md nav-sm');
    });

    // Sidebar sub-menu toggle; other menu items are dead links in this demo
    $('.side-menu > li > a').on('click', function (e) {
        e.preventDefault();
        var $li = $(this).parent();
        if ($li.children('.child_menu').length) {
            $li.toggleClass('open');
        } else {
            SBToast.show('This menu item is not part of the demo.', 'info');
        }
    });
    $('.child_menu a').on('click', function (e) {
        e.preventDefault();
        if (!$(this).parent().hasClass('current-page')) {
            SBToast.show('This menu item is not part of the demo.', 'info');
        }
    });
});
</script>
</body>
</html>
