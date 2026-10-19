/* =====================================================================
 * data.js – single source of truth for the StandBy demo.
 *
 * Everything lives in memory: no database, no API calls.
 * All three views read and write ONLY through the SBData object below,
 * so connecting the screen to real endpoints means changing this file only:
 *   - replace SEED with data loaded from the server (e.g. $.getJSON)
 *   - replace the bodies of applyChanges() / removeMapping() with $.ajax
 *     calls, then refresh the local copy and call notify().
 *
 * Every data change fires the jQuery event "sb:change" on document.
 * ===================================================================== */
var SBData = (function ($) {
    'use strict';

    /* ---------- Seed data (original sample data) ---------- */
    var SEED = {
        corporates: [
            { id: 1, corporatename: 'Hemant Corp',                   companyname: 'Hemant Standby Company Name',  start_date: '2025-04-01', end_date: '2027-03-31', status: 'Active' },
            { id: 2, corporatename: 'Amit Sir Corporate',            companyname: 'Amit Sir Company',             start_date: '2025-06-15', end_date: '2026-12-31', status: 'Active' },
            { id: 3, corporatename: 'Hemant Test StandBy corporate', companyname: 'Hemant Test StandBay Company', start_date: '2026-01-01', end_date: '2026-12-31', status: 'Active' },
            { id: 4, corporatename: 'Mahambre and Company',          companyname: 'Mahambre and Company',         start_date: '2025-10-01', end_date: '2027-09-30', status: 'Active' }
        ],

        locations: [
            // Hemant Corp
            { id: 101, corporate_id: 1, location_title: 'Thane – Shivam IT Park',       address1: 'Shivam IT Park, Road Number 16, Nehru Nagar, Wagle Industrial Estate', address2: 'Thane West, Thane, Maharashtra, India',      start_date: '2025-04-01', end_date: '2027-03-31' },
            { id: 102, corporate_id: 1, location_title: 'Thane – Ashtavinayak Complex', address1: 'Ashtavinayak Complex, Puranik Villas, Kalher', address2: 'Thane, Maharashtra, India',           start_date: '2025-04-01', end_date: '2027-03-31' },
            { id: 103, corporate_id: 1, location_title: 'Navi Mumbai – Vashi',          address1: 'Sector 30A, Inorbit Mall',  address2: 'Vashi, Navi Mumbai 400703',           start_date: '2025-07-01', end_date: '2027-03-31' },
            // Amit Sir Corporate
            { id: 201, corporate_id: 2, location_title: 'Powai',                        address1: 'Hiranandani Gardens',       address2: 'Powai, Mumbai 400076',                start_date: '2025-06-15', end_date: '2026-12-31' },
            { id: 202, corporate_id: 2, location_title: 'Andheri East – MIDC',          address1: 'MIDC Central Road',         address2: 'Andheri East, Mumbai 400093',         start_date: '2025-06-15', end_date: '2026-12-31' },
            { id: 203, corporate_id: 2, location_title: 'BKC',                          address1: 'G Block, Bandra Kurla Complex', address2: 'Bandra East, Mumbai 400051',      start_date: '2025-09-01', end_date: '2026-12-31' },
            // Hemant Test StandBy corporate
            { id: 301, corporate_id: 3, location_title: 'Pune – Hinjewadi',             address1: 'Rajiv Gandhi Infotech Park, Phase 1', address2: 'Hinjewadi, Pune 411057',   start_date: '2026-01-01', end_date: '2026-12-31' },
            { id: 302, corporate_id: 3, location_title: 'Pune – Kharadi',               address1: 'EON IT Park',               address2: 'Kharadi, Pune 411014',                start_date: '2026-01-01', end_date: '2026-12-31' },
            // Mahambre and Company
            { id: 401, corporate_id: 4, location_title: 'Lower Parel – Kamala Mills',   address1: 'Senapati Bapat Marg',       address2: 'Lower Parel, Mumbai 400013',          start_date: '2025-10-01', end_date: '2027-09-30' },
            { id: 402, corporate_id: 4, location_title: 'Goregaon – NESCO',             address1: 'NESCO IT Park, Western Express Hwy', address2: 'Goregaon East, Mumbai 400063', start_date: '2025-10-01', end_date: '2027-09-30' },
            { id: 403, corporate_id: 4, location_title: 'Malad – Mindspace',            address1: 'Mindspace, Link Road',      address2: 'Malad West, Mumbai 400064',           start_date: '2026-02-01', end_date: '2027-09-30' }
        ],

        drivers: [
            { id: 1,  full_name: 'Chinmay Test',    mobile_no: '9833276937' },
            { id: 2,  full_name: 'Ramesh Patil',    mobile_no: '9820145236' },
            { id: 3,  full_name: 'Suresh Yadav',    mobile_no: '9867301458' },
            { id: 4,  full_name: 'Imran Shaikh',    mobile_no: '9819724503' },
            { id: 5,  full_name: 'Santosh Jadhav',  mobile_no: '9773068124' },
            { id: 6,  full_name: 'Vikas Gupta',     mobile_no: '9892417760' },
            { id: 7,  full_name: 'Ganesh More',     mobile_no: '9004512387' },
            { id: 8,  full_name: 'Rajesh Kumar',    mobile_no: '9930286641' },
            { id: 9,  full_name: 'Anil Shinde',     mobile_no: '9821660392' },
            { id: 10, full_name: 'Mahesh Pawar',    mobile_no: '9769034518' },
            { id: 11, full_name: 'Sachin Kadam',    mobile_no: '9867512094' },
            { id: 12, full_name: 'Deepak Singh',    mobile_no: '9920378815' },
            { id: 13, full_name: 'Prakash Naik',    mobile_no: '9637205149' },
            { id: 14, full_name: 'Abdul Rahman',    mobile_no: '9881043276' },
            { id: 15, full_name: 'Manoj Tiwari',    mobile_no: '9822917305' },
            { id: 16, full_name: 'Nitin Salunkhe',  mobile_no: '9850364712' },
            { id: 17, full_name: 'Ravi Chavan',     mobile_no: '9765208143' },
            { id: 18, full_name: 'Sunil Gaikwad',   mobile_no: '9819560237' },
            { id: 19, full_name: 'Tushar Mane',     mobile_no: '9967412058' },   // unassigned
            { id: 20, full_name: 'Farhan Qureshi',  mobile_no: '9702834561' }    // unassigned
        ],

        // Each mapping is one dated shift, repeated daily up to end_date when set. shift_date is filled with today's date on load
        // unless set here ("YYYY-MM-DD"); end <= start means the shift runs past midnight.
        mappings: [
            // Hemant Corp – Thane – Shivam IT Park
            { id: 1,  driver_id: 1,  corporate_id: 1, location_id: 101, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            { id: 2,  driver_id: 3,  corporate_id: 1, location_id: 101, shift_type: 'Permanent', shift_start_time: '16:00', shift_end_time: '00:00' },
            { id: 3,  driver_id: 5,  corporate_id: 1, location_id: 101, shift_type: 'Reliever',  shift_start_time: '18:30', shift_end_time: '20:30' },
            // Hemant Corp – Thane – Ashtavinayak Complex
            { id: 4,  driver_id: 2,  corporate_id: 1, location_id: 102, shift_type: 'Permanent', shift_start_time: '14:00', shift_end_time: '22:00' },
            { id: 5,  driver_id: 6,  corporate_id: 1, location_id: 102, shift_type: 'Reliever',  shift_start_time: '08:00', shift_end_time: '14:00' },
            // Hemant Corp – Navi Mumbai – Vashi (night shift crosses midnight)
            { id: 6,  driver_id: 7,  corporate_id: 1, location_id: 103, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            { id: 7,  driver_id: 8,  corporate_id: 1, location_id: 103, shift_type: 'Permanent', shift_start_time: '22:00', shift_end_time: '06:00' },
            // Amit Sir Corporate – Powai (Chinmay Test's 2nd assignment, no overlap)
            { id: 8,  driver_id: 9,  corporate_id: 2, location_id: 201, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            { id: 9,  driver_id: 1,  corporate_id: 2, location_id: 201, shift_type: 'Reliever',  shift_start_time: '16:30', shift_end_time: '22:30' },
            // Amit Sir Corporate – Andheri East – MIDC
            // DELIBERATE OVERLAP: Ramesh Patil 18:30–20:30 here overlaps his 14:00–22:00 at Ashtavinayak.
            { id: 10, driver_id: 10, corporate_id: 2, location_id: 202, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            { id: 11, driver_id: 11, corporate_id: 2, location_id: 202, shift_type: 'Permanent', shift_start_time: '16:00', shift_end_time: '00:00' },
            { id: 12, driver_id: 2,  corporate_id: 2, location_id: 202, shift_type: 'Reliever',  shift_start_time: '18:30', shift_end_time: '20:30' },
            // Amit Sir Corporate – BKC
            { id: 13, driver_id: 12, corporate_id: 2, location_id: 203, shift_type: 'Permanent', shift_start_time: '09:00', shift_end_time: '18:00' },
            { id: 14, driver_id: 13, corporate_id: 2, location_id: 203, shift_type: 'Permanent', shift_start_time: '22:00', shift_end_time: '06:00' },
            // Hemant Test StandBy corporate – Pune
            { id: 15, driver_id: 14, corporate_id: 3, location_id: 301, shift_type: 'Permanent', shift_start_time: '06:00', shift_end_time: '14:00' },
            { id: 16, driver_id: 15, corporate_id: 3, location_id: 301, shift_type: 'Permanent', shift_start_time: '14:00', shift_end_time: '22:00' },
            { id: 17, driver_id: 16, corporate_id: 3, location_id: 301, shift_type: 'Reliever',  shift_start_time: '22:00', shift_end_time: '06:00' },
            { id: 18, driver_id: 17, corporate_id: 3, location_id: 302, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            // Mahambre and Company (Malad – Mindspace has NO driver on purpose)
            { id: 19, driver_id: 18, corporate_id: 4, location_id: 401, shift_type: 'Permanent', shift_start_time: '08:00', shift_end_time: '16:00' },
            { id: 20, driver_id: 4,  corporate_id: 4, location_id: 402, shift_type: 'Permanent', shift_start_time: '16:00', shift_end_time: '00:00' }
        ]
    };

    var MAX_LOG = 10;
    var db;          // working copy of SEED
    var log;         // recent changes, newest first: { label, source, time, before }
    var nextId;

    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* Today's date as "YYYY-MM-DD" (local time). */
    function today() {
        var t = new Date();
        return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2);
    }

    function byId(list, id) {
        id = +id;
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { return list[i]; }
        }
        return null;
    }

    function notify(reason) { $(document).trigger('sb:change', [reason]); }

    /* Snapshot mappings, run the mutation, record it for "Recent changes"/Undo. */
    function commit(label, source, mutate) {
        var before = clone(db.mappings);
        mutate();
        log.unshift({ label: label, source: source || '', time: new Date(), before: before });
        if (log.length > MAX_LOG) { log.length = MAX_LOG; }
        notify('commit');
    }

    /* ---------- Reads ---------- */
    var api = {
        corporates: function () { return db.corporates.slice(); },
        corporate:  function (id) { return byId(db.corporates, id); },

        /* All locations, or only those of one corporate. */
        locations: function (corporateId) {
            if (corporateId === undefined || corporateId === null || corporateId === '') { return db.locations.slice(); }
            return db.locations.filter(function (l) { return l.corporate_id === +corporateId; });
        },
        location: function (id) { return byId(db.locations, id); },

        drivers: function () { return db.drivers.slice(); },
        driver:  function (id) { return byId(db.drivers, id); },

        mappings: function () { return db.mappings.slice(); },
        mapping:  function (id) { return byId(db.mappings, id); },
        mappingsAt: function (locationId) {
            return db.mappings.filter(function (m) { return m.location_id === +locationId; });
        },
        mappingsOf: function (driverId) {
            return db.mappings.filter(function (m) { return m.driver_id === +driverId; });
        },

        /* Drivers without any assignment. */
        unassignedDrivers: function () {
            var used = {};
            db.mappings.forEach(function (m) { used[m.driver_id] = true; });
            return db.drivers.filter(function (d) { return !used[d.id]; });
        },

        recentChanges: function () { return log.slice(); },

        /* ---------- Writes ----------
         * change = { mapping_id (null = new), driver_id, location_id, shift_type,
         *            shift_date (optional, "YYYY-MM-DD"), end_date (optional: repeat daily up to
         *            this date, null = single day), shift_start_time, shift_end_time }
         * Moving a driver updates the mapping in place (corporate, location,
         * type, times), so the driver leaves the old location.
         */
        applyChanges: function (changes, label, source) {
            commit(label, source, function () {
                changes.forEach(function (c) {
                    var loc = byId(db.locations, c.location_id);
                    var m = c.mapping_id ? byId(db.mappings, c.mapping_id) : null;
                    var fields = {
                        driver_id: +c.driver_id,
                        corporate_id: loc.corporate_id,
                        location_id: loc.id,
                        shift_type: c.shift_type,
                        shift_date: c.shift_date || (m && m.shift_date) || today(),
                        end_date: c.end_date !== undefined ? c.end_date : (m && m.end_date),
                        shift_start_time: c.shift_start_time,
                        shift_end_time: c.shift_end_time
                    };
                    // A repeating shift keeps end_date; a single day stores null.
                    if (!fields.end_date || fields.end_date <= fields.shift_date) { fields.end_date = null; }
                    if (m) {
                        $.extend(m, fields);
                    } else {
                        fields.id = nextId++;
                        db.mappings.push(fields);
                    }
                });
            });
        },

        removeMapping: function (id, label, source) {
            commit(label, source, function () {
                db.mappings = db.mappings.filter(function (m) { return m.id !== +id; });
            });
        },

        /* Undo the most recent change. Returns the undone log entry or null. */
        undo: function () {
            if (!log.length) { return null; }
            var entry = log.shift();
            db.mappings = entry.before;
            notify('undo');
            return entry;
        },

        /* Reload the original sample data. */
        reset: function () {
            db = clone(SEED);
            log = [];
            nextId = 1;
            db.mappings.forEach(function (m) {
                nextId = Math.max(nextId, m.id + 1);
                m.shift_date = m.shift_date || today();   // sample shifts start today
                m.end_date = m.end_date || null;
            });
            notify('reset');
        }
    };

    // Initial load (no event listeners are attached yet, so this is silent).
    api.reset();
    return api;
}(jQuery));
