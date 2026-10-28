# Department Management (Stage 1)

Database (run in the SQL editor of the SAME database the app uses, after a backup, one file at a time):
1. `40_dept_mgmt.sql` — new tables dm_* , triggers, RLS. Additive; safe to run twice. (Needs 30_campus.sql already run.)
2. `41_dept_evidence_storage.sql` — private bucket for evidence files. Needed only from Stage 3.

Then upload the app files. A new sidebar item "विभागीय व्यवस्थापन / Department Management" opens /department.

Who can do what (enforced by the database):
- Administration (admin role): everything; the only role that approves plans / budgets.
- Department head (appointed in Setup -> Campus): own department's plans, activities, budget, expenses.
- Teacher: reads own department's plans and activities; updates progress only of activities assigned to them.
- Budget lines and expenses are visible to the head and the administration only.
