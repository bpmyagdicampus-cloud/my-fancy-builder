# Department Management (Complete — All Stages)

Database (run in the SQL editor of the SAME database the app uses, after a backup, one file at a time):
1. `40_dept_mgmt.sql` — creates tables `dm_plans`, `dm_plan_revisions`, `dm_activities`, `dm_budget_lines`, `dm_budget_revisions`, `dm_expenses`, `dm_evidence`, triggers, helper RPCs (`dm_budget_decide_revision`, `dm_dept_teachers`) and RLS policies. Additive; safe to run twice. (Needs `30_campus.sql` already run.)
2. `41_dept_evidence_storage.sql` — creates private bucket `dept-evidence` for activity and voucher evidence files (up to 10 MB).
3. `42_dept_teachers.sql` — optional standalone script if `40_dept_mgmt.sql` was already run earlier (adds `dm_dept_teachers` RPC so Department Heads can select teachers of their department from a dropdown).

## Features included in `/department`
- **Overview (`सारांश`)**: Live counts of annual plans, activities by status, average progress %, and (for HOD/Admin) proposed, approved, spent, and remaining budget.
- **Annual Plans (`वार्षिक योजना`)**: Create, edit, copy, submit for approval, approve/reject with comments, and view full version history (`dm_plan_revisions`).
- **Activities & Progress (`गतिविधि तथा प्रगति`)**: Add activities linked to annual plans, assign responsible teachers, update progress percentage (%) and actual output, record challenges/corrective actions, and upload/view evidence files (`dept-evidence`).
- **Budget & Expenses (`बजेट तथा खर्च`)**: Propose and approve budget lines, submit and decide budget revision requests (`dm_budget_decide_revision`), record itemized expenses with voucher numbers, create negative reversal entries for corrections, lock/unlock expenses, and attach voucher receipts.
- **Automated Reports (`स्वचालित प्रतिवेदन`)**: Generate annual, monthly, or custom BS date-range departmental reports with one-click export to **PDF / Print**, **Word (.doc)**, and **Excel (.xls)**.
