# StandBy Corporate – Update Schedule (UI demo)

A click-through demo for a client presentation. It shows **three alternative UIs** for one admin task:
*manage driver location assignment and shift timing*. All three views share the same in-memory sample
data and the same business rules. Only the UI differs.

No backend, no database, no API calls. PHP is used only for `include`s.

---

## Run it on XAMPP

1. Copy the folder into `C:\xampp\htdocs\` (e.g. `C:\xampp\htdocs\standby-demo\`; any folder name works).
2. Start **Apache** in the XAMPP Control Panel (MySQL is not needed).
3. Open **http://localhost/standby-demo/** (or `http://localhost/Dial42-demo/` if you kept this folder name).

You need an internet connection, because Bootstrap 3.3.7, Font Awesome 4.7 and jQuery 3.7.1 load from cdnjs.

- **Reset demo data** (top-right) restores the original sample data at any time. Reloading the page does the same.
- The last selected tab is remembered in `localStorage`.

---

## File map

```
index.php                 Page shell: sidebar, top bar, 3 tabs, tab memory, reset link
partials/header.php       Top navigation bar (search box, Reset demo data, "Welcome : Admin")
partials/sidebar.php      Left menu (Dashboard, Corporate Master, StandBy ▸ …, Drivers, Reports)
views/view1_from_to.php   View 1 markup – From / To (+ confirm modal)
views/view2_calendar.php  View 2 markup – Calendar grid (+ edit/assign drawer)
views/view3_board.php     View 3 markup – Driver board (+ recent changes log)
assets/css/demo.css       Admin-panel theme + styles for all three views (colour tokens at the top)
assets/js/data.js         ALL sample data + the only read/write API (SBData). Single source of truth.
assets/js/rules.js        SBUtil (escaping, time maths), SBRules (validation), SBToast (toasts)
assets/js/view1.js        View 1 behaviour
assets/js/view2.js        View 2 behaviour (pointer-event drag / resize, no libraries)
assets/js/view3.js        View 3 behaviour (pointer-event drag & drop, popovers, undo)
```

### How the pieces talk
- Views read and write data **only** through `SBData` (`data.js`). Every change fires a jQuery
  `sb:change` event on `document`, and every view re-renders itself. A change made in one tab
  therefore shows up in the others immediately.
- Every save first runs `SBRules.validate(changes)`. **Errors** block the save. **Warnings** are shown,
  and the user can save anyway after reviewing them.
- **Connecting to a real backend later:** replace `SEED` in `data.js` with data loaded from the server,
  and replace the bodies of `applyChanges()` and `removeMapping()` with `$.ajax` calls. The views
  don't need to change.

### Business rules (same as production)
| Type | Rule |
|---|---|
| Error | No destination location · start/end time missing or invalid · start = end · shift date missing, or moved to a past date · nothing changed · driver already has a shift at the destination on that date · same driver moved twice to the same location and date in one batch |
| Warning | New shift overlaps another shift of the same driver (any date, any location, including overnight shifts running into the next day) · destination already has an overlapping **Permanent** driver (drivers moving out in the same batch don't count) · two drivers in the batch both Permanent with overlapping shifts at the same location |

- A shift with end ≤ start runs past midnight (22:00–06:00). All overlap checks handle this.
- Every shift has a `shift_date`. The sample shifts all start **today**. View 2 shows 7 days (today onwards by default); an overnight shift shows on its start date and continues at the top of the next date's column.
- A shift can repeat daily: set a **From** and **To** date in View 2's edit panel (`end_date`). It shows on every day of the range. Changing one day (drag or edit panel) asks **Only this day** (that day is split off as its own shift, the rest keeps repeating) or **All days**. Conflicts are flagged per day.
- View 2 has two layouts so the grid stays narrow with any number of locations: **Week** (one location, its 7 dates as columns, location tabs above) and **Day** (one date, every location as a column, date tabs above). Drop a shift on a tab to move it to that location / date. Clicking a date header (Week) or a location header (Day) switches layout.
- Moving a driver updates the existing mapping in place, so the driver leaves the old location.
- Assumption: the "existing Permanent driver" warning applies when the driver being moved/edited is
  also Permanent. Relievers are expected to overlap.

### Sample data highlights
- 4 standby corporates, 11 locations, 20 drivers, 20 assignments.
- **Chinmay Test** has 2 assignments (Shivam IT Park 08:00–16:00, Powai 16:30–22:30).
- **Ramesh Patil** is deliberately double-booked (Ashtavinayak 14:00–22:00 overlaps Andheri 18:30–20:30). Both cards and blocks show ⚠.
- **Malad – Mindspace** (Mahambre and Company) has no driver.
- **Tushar Mane** and **Farhan Qureshi** are unassigned.
- Night shifts that cross midnight: Rajesh Kumar (Vashi), Prakash Naik (BKC), Nitin Salunkhe (Hinjewadi).

---

## 2-minute demo script

Click **Reset demo data** before you start.

### View 1 – From / To (≈ 40 s)
"This is today's screen, cleaned up."
1. **Move:** Hemant Corp / Thane – Shivam IT Park is pre-selected. Tick **Santosh Jadhav**. On the right,
   set *Location* to **Powai**. Click **Preview** → "No conflicts found." Click **Confirm**, then
   **OK, update** → a toast appears, and Santosh is gone from the left list.
2. **Error:** tick **Chinmay Test**, set *Location* to **Powai** and click **Preview**. The red row says
   "Driver is already assigned to Amit Sir Corporate / Powai…". **Confirm** stays disabled.
3. **Warning:** change Chinmay's location to **Thane – Ashtavinayak Complex** and click **Preview**. The amber
   row says "…already has a Permanent driver in this time: Ramesh Patil". Confirm is enabled after review.
4. (Optional) Show **Bulk defaults**: pick a corporate, location or times, then click **Apply to all**.

### View 2 – Calendar (≈ 45 s)
"One corporate at a time, as a timeline. **Week** shows one location over 7 days; **Day** shows every location on one day." It opens in Week view on **Thane – Shivam IT Park**.
1. **Time change:** drag the top edge of **Suresh Yadav**'s block (Shivam IT Park) from 16:00 down to 17:00. The end follows to keep an 8-hour slot (17:00–01:00) → Saved. Click the block to see the new times in the drawer.
   You can also drag a whole block up or down to shift both times (it snaps to 15 minutes).
2. **Move:** click the **B Thane – Ashtavinayak Complex** tab, then drag **Vikas Gupta**'s block onto the **C Navi Mumbai – Vashi** tab → Saved, and the tab flashes. (Or switch to **Day** view and drag it into the Vashi column.)
3. **Warning:** back on the **A** tab, drag **Chinmay Test**'s block down one hour (09:00–17:00). It now overlaps his own Powai
   shift (16:30–22:30), so the block gets a red outline with ⚠. Hover it to read the warning.
4. **Cross-corporate move:** on the **C Navi Mumbai – Vashi** tab, click **Ganesh More**'s block. In the drawer, set *Standby Corporate* to
   **Mahambre and Company** and *Location* to **Malad – Mindspace**, then click **Save**. The block disappears,
   and a toast says where Ganesh went.
5. **Error:** click **Suresh Yadav**'s block, set *Shift End Time* equal to the *Shift Start Time* and click
   **Save** → "Start and end time cannot be the same."
6. (Optional) Drag **Tushar Mane** from *Unassigned drivers* onto a column, or click an empty slot. Toggle **1 hr** zoom.

### View 3 – Driver Board (≈ 35 s)
"Driver-first, across all corporates."
1. Point out the **coverage bars** (Malad – Mindspace: "24h not covered") and the ⚠ on Ramesh Patil's cards.
2. **Move across corporates:** drag **Santosh Jadhav**'s card to **Lower Parel – Kamala Mills** →
   the popover shows From → To with editable times → **Move**.
3. **Warning:** drag **Anil Shinde** (Powai) to **BKC** → "…already has a Permanent driver: Deepak Singh".
   Click **Move anyway**.
4. **Error:** drag **Chinmay Test**'s Shivam IT Park card to **Powai** → "Driver is already assigned…". Cancel.
5. **Multi-move:** Ctrl-click two cards, then drag them together.
6. **⋮ menu:** *Edit timing*, *Change to Reliever/Permanent* and *Remove from location*. The removed driver
   appears under **Unassigned**.
7. **Undo** in *Recent changes* reverts the last change. The log lists changes from all three views.

Finally, switch back to **View 1** or **View 2** to show that every change appears there too.
