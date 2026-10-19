# Manual tests (cannot be run by the assistant — they need the real Supabase project and a browser)

Mark each line PASS / FAIL and send the FAIL ones.

## A. Isolation between users (RLS)
Create two teachers, `tea1` and `tea2`, from the Admin page. Put one diary entry in each.
1. Sign in as tea1 → Daily Diary shows only tea1's entry.  [ ]
2. Sign in as tea2 in a private window → only tea2's entry; tea1's data is not visible.  [ ]
3. Direct database request as tea1 (browser console on the signed-in app). Replace URL and KEY with the values
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from your `.env`:
```js
const URL = "https://YOUR-PROJECT.supabase.co", KEY = "YOUR-PUBLISHABLE-KEY";
let tok; for (const s of [localStorage, sessionStorage]) for (let i = 0; i < s.length; i++) { try { const v = JSON.parse(s.getItem(s.key(i))); if (v && v.access_token) tok = v.access_token; } catch {} }
const get = (p) => fetch(URL + "/rest/v1/" + p, { headers: { apikey: KEY, Authorization: "Bearer " + tok } }).then((r) => r.json());
get("teacher_data?select=teacher_id,version").then(console.log);   // expected: ONLY your own row
get("profiles?select=id,name").then(console.log);                 // expected: ONLY your own row
get("user_roles?select=*").then(console.log);                      // expected: ONLY your own role(s)
```
   Expected for a teacher: one row each. For the administrator: all rows.  [ ]
4. As tea1 try to write tea2's diary (replace TEA2-ID):  
   `fetch(URL+"/rest/v1/teacher_data?teacher_id=eq.TEA2-ID",{method:"PATCH",headers:{apikey:KEY,Authorization:"Bearer "+tok,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify({version:999})}).then(r=>r.json()).then(console.log)`  
   Expected: `[]` (nothing changed).  [ ]
5. A student account cannot open Daily Diary / Setup (sees the welcome page only).  [ ]
6. Sign-up is really off: in a private window the login page has no way to register.  [ ]

## B. Two browsers at the same time
1. Sign in as the same teacher in Chrome and in a private window.
2. In window 1 add a diary entry, wait for “Saved ✓”.
3. In window 2 (still showing the old data) add a different entry.
   Expected: red bar “changed from another device” with two buttons; the entry from window 1 is NOT lost silently.  [ ]
4. “Use cloud copy” downloads a file with window 2's work first, then shows window 1's data.  [ ]

## C. Offline → online
1. Signed in, open DevTools → Network → set “Offline”.
2. Add a diary entry. Expected: top bar “Not saved ⚠”, red bar with “Try again now”, entry still visible.  [ ]
3. Reload the page while still offline. Expected: the app opens with the entry (offline message).  [ ]
4. Set Network back to “No throttling”. Expected within ~15 s (or press “Try again now”): “Saved ✓”.  [ ]
5. Offline again, add an entry, press **Sign out** → a file is downloaded and a recovery copy is listed in My account.  [ ]

## D. Moving old data to the cloud
1. Teacher profiles → Backup (keep the file).
2. My account → Move old on-device data to the cloud → the message lists the record counts. Compare with the old diary.  [ ]
3. Press it a second time: the counts do not double.  [ ]

## E. New user
Admin → New account: create a teacher, a student and an admin. For each, sign in from a private window.  [ ]
If it fails, the red message under “Admin” now shows the exact reason — send it.
