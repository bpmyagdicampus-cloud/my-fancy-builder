# Phase 2 — login, roles, cloud diary

Order matters:
1. Run `01_add_student_role.sql` (alone), then `02_accounts_and_storage.sql`.
2. In Authentication settings, turn OFF "Allow new users to sign up" (only the admin creates accounts).
3. Create your own user in Authentication -> Users (Add user, auto-confirm), then run `03_make_first_admin.sql` with that e-mail.
4. Copy the code files to GitHub, wait for Lovable to build, open the app, sign in with that e-mail.
5. Account page -> "Move old on-device data to the cloud" -> choose your old profile.
