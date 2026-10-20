# Account access
- [x] Resolve publishing failure: restored missing recovery exports, corrected incompatible calls and optional types, removed links to the absent SQC page; build OK, 17 tests pass, repaired pages return 200 without runtime errors.
- [ ] Fix loading in the latest externally edited version — blocked on its current source files: published /profiles shows an error while this checkout reaches login; preview telemetry reports missing login connection configuration and an SQC page absent from this checkout. Cloud is healthy. Obtain the latest source before replacing any externally added features.
- [x] Enable Cloud and email authentication.
- [x] Create account-owned profiles and diary data with admin/teacher RLS.
- [ ] Connect existing screens to Cloud, add login/logout and admin teacher selection.
- [ ] Verify sign-in, persistence, and cross-teacher access restrictions.