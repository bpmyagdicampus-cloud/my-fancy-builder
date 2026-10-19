# SQC and active-year tests (manual — need the real Supabase project)

Do these AFTER running 10_academic_years.sql and 20_sqc.sql. Mark PASS / FAIL.

## Setup
1. Admin → Academic year: add `2083/84`, make it active.  [ ]
2. SQC → Setup → Classes: add `BBS I` (A) and `BBS II`.  [ ]
3. SQC → Setup → Period times: save periods 1–3 (for example 07:00–07:45, 07:45–08:30, 08:30–09:15).  [ ]
4. Admin → New account: students `cr1` (class BBS I, representative) and `cr2` (class BBS II, representative); a teacher `tea1`.  [ ]

## Representative can work only on their own class
5. Sign in as cr1 (private window). SQC shows "New report" with only BBS I in the class list.  [ ]
6. Submit a report (held, arrival 07:10). It appears under Reports with status Submitted.  [ ]
7. Submit the same class/date/period again → clear message that it already exists.  [ ]
8. Edit it while Submitted → works. Admin sets "Under Review" → cr1 can no longer edit it.  [ ]
9. Sign in as cr2: cr2 sees NO report of BBS I (list empty).  [ ]
10. Direct database requests as cr2 (console snippet from docs/audit/MANUAL_TESTS.md, same `get` helper):
    - `get("sqc_reports?select=id,class_id")` → expected `[]` (or only BBS II rows)  [ ]
    - `get("sqc_actions?select=*")` → expected `[]`  [ ]
    - `get("sqc_members?select=*")` → expected only cr2's own row  [ ]
    - Try to insert a BBS I report as cr2 (POST to /rest/v1/sqc_reports with BBS I's class_id) → expected an error (403 / row-level security)  [ ]
    - As cr1 try to PATCH your own report's `status` to `Resolved` → expected an error ("cannot change")  [ ]
    - As cr1 call `get("sqc_teacher_list")` is not needed; call the RPC `/rest/v1/rpc/sqc_teacher_list` as a student who is NOT a representative → expected an error  [ ]
11. Changing the page address cannot show another class: the SQC page has no class id in its address; the database refuses other classes anyway (step 10).  [ ]

## Administrator workflow
12. Admin sees every report, can filter by class, teacher, month, period, status, text.  [ ]
13. Open a report → Respond: write a response, responsible person, action taken, set status "In Progress", then later "Resolved" with a date. The history shows each step.  [ ]
14. cr1 sees the administrator's response on their report.  [ ]
15. Teacher `tea1` (if named in a report) sees only reports that name them, read-only, with responses.  [ ]
16. Summary tab: month and selected-period summaries; counts by status; table by class and by teacher.  [ ]
17. Print (or Save as PDF) of the Reports list and of the Summary looks clean (orientation selector works).  [ ]

## Active academic year
18. As a teacher, Academic years → "Start 2083/84" is offered with the name fixed; after starting, the start button disappears.  [ ]
19. Admin makes `2084/85` active → teachers see the notice and can start it; a teacher cannot change which year is active (no such button; the database refuses a direct request).  [ ]
