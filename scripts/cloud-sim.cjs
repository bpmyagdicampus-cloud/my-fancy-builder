/* Simulation of the cloud-sync layer against a FAKE in-memory Supabase.
 * Run:  node scripts/cloud-sim.cjs      (needs the "typescript" package, already a dev dependency of the project)
 * This checks the app's save/conflict/offline logic. It does NOT test the real Supabase (RLS, network). */
const fs = require("fs"), os = require("os"), path = require("path"), assert = require("assert"), Module = require("module");
let ts; try { ts = require("typescript"); } catch { console.error("Install dependencies first (npm install), the 'typescript' package is needed."); process.exit(2); }
const SRC = path.join(__dirname, "..", "src", "lib");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "cloud-sim-"));
const MODS = ["id", "students", "years", "migrate", "store", "login", "cloud"];
for (const m of MODS) {
  const js = ts.transpileModule(fs.readFileSync(path.join(SRC, m + ".ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  fs.writeFileSync(path.join(OUT, m + ".js"), js);
}
// ---- fakes
let ls = {};
global.localStorage = { getItem: (k) => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: (k) => { delete ls[k]; }, get length() { return Object.keys(ls).length; }, key: (i) => Object.keys(ls)[i] ?? null };
global.window = { addEventListener() {} };
let alerts = [], answer = true, downloads = 0;
global.alert = (m) => alerts.push(m);
global.confirm = () => answer;
global.document = { createElement: () => ({ click() { downloads++; } }) };
global.URL.createObjectURL = () => "blob:x";
const U1 = "u-1", U2 = "u-2";
const prof = (id, name) => ({ id, name, designation: "", dept: "", campus: "Beni", address: "", hod: "", chief: "" });
let tables, net, failInsert, listeners;
const resetWorld = () => {
  tables = { profiles: { [U1]: prof(U1, "Bishnu"), [U2]: prof(U2, "Other") }, teacher_data: { [U1]: { teacher_id: U1, content: { classes: [{ id: "c1", name: "BBS I", subject: "A", students: "" }] }, version: 0 }, [U2]: { teacher_id: U2, content: {}, version: 0 } }, user_roles: [{ user_id: U1, role: "teacher" }, { user_id: U2, role: "teacher" }] };
  net = true; failInsert = false; listeners = [];
};
const NETERR = { data: null, error: { message: "TypeError: Failed to fetch" } };
function q(table) {
  const st = { filters: {}, op: "select", patch: null }; const api = {
    select() { if (st.op !== "update") st.op = "select"; return api; }, update(p) { st.op = "update"; st.patch = p; return api; }, insert(p) { st.op = "insert"; st.patch = p; return api; },
    eq(k, v) { st.filters[k] = v; return api; }, maybeSingle() { st.single = true; return api; }, then(res, rej) { return Promise.resolve(run()).then(res, rej); } };
  function run() {
    if (!net) return NETERR;
    if (table === "user_roles") return { data: tables.user_roles.filter((r) => r.user_id === st.filters.user_id), error: null };
    const key = table === "profiles" ? "id" : "teacher_id"; const row = tables[table][st.filters[key]];
    if (st.op === "select") return { data: st.single ? (row ?? null) : row ? [row] : [], error: null };
    if (st.op === "insert") { if (failInsert) return { data: null, error: { message: "permission denied for table teacher_data" } }; if (!row) tables[table][st.patch.teacher_id] = { ...st.patch, content: {}, version: 0 }; return { data: null, error: null }; }
    if (st.op === "update") { if (!row) return { data: [], error: null }; if ("version" in st.filters && row.version !== st.filters.version) return { data: [], error: null }; Object.assign(row, st.patch); return { data: [{ version: row.version }], error: null }; }
  }
  return api;
}
const fakeSb = { from: q, auth: { onAuthStateChange(cb) { listeners.push(cb); }, getSession: async () => ({ data: { session: null } }), signOut: async () => ({}) }, storage: { from: () => ({}) } };
const real = Module._load;
Module._load = function (req, ...a) {
  if (req === "react") return { useSyncExternalStore: () => ({}), useEffect() {}, useState: (v) => [v, () => {}] };
  if (req === "@/integrations/supabase/client") return { supabase: fakeSb };
  const m = req.match(/^@\/lib\/(\w+)$/) || req.match(/^\.\/(\w+)$/);
  if (m && MODS.includes(m[1])) return real(path.join(OUT, m[1] + ".js"), ...a);
  return real(req, ...a);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function fresh({ keepStorage = false } = {}) {
  for (const m of MODS) delete require.cache[path.join(OUT, m + ".js")];
  if (!keepStorage) ls = {};
  alerts = []; downloads = 0; answer = true; listeners = [];
  return { store: require(path.join(OUT, "store.js")), cloud: require(path.join(OUT, "cloud.js")) };
}
const login = async (c, id = U1) => { c.initAuth(); listeners[0]("SIGNED_IN", { user: { id, email: id + "@shikshakdiary.app" } }); await sleep(60); };
let passed = 0; const ok = (m) => { passed++; console.log("  ✓", m); };

(async () => {
  console.log("1. sign-in, save, profile sync, conflict, offline failure, sign-out");
  resetWorld(); let { store, cloud } = fresh();
  store.mutate((x) => { x.profiles.push(prof("legacy01", "Old")); x.data.legacy01 = store.emptyData(); x.current = "legacy01"; });
  await login(cloud);
  let db = store.getDB();
  assert.ok(db.data[U1] && db.current === U1 && db.data[U1].classes.length === 1 && db.data[U1].years.length === 1); ok("cloud diary loaded, old years/students conversion applied");
  store.updateData((d) => { d.diary.push({ id: "d1" }); }); await sleep(1500);
  assert.strictEqual(tables.teacher_data[U1].version, 1); ok("edit saved, version 0 -> 1");
  store.mutate((x) => { x.profiles.find((p) => p.id === U1).campus = "New campus"; }); await sleep(1500);
  assert.strictEqual(tables.profiles[U1].campus, "New campus"); ok("profile changes synced");
  tables.teacher_data[U1].version = 5; tables.teacher_data[U1].content.classes = [{ id: "zz" }];
  store.updateData((d) => { d.diary.push({ id: "d2" }); }); await sleep(1500);
  assert.strictEqual(tables.teacher_data[U1].version, 5); assert.strictEqual(cloud.getCloudState().save, "conflict"); ok("other device saved first -> conflict, cloud copy NOT overwritten");
  await cloud.resolveConflict("keep-mine"); await sleep(100);
  assert.strictEqual(tables.teacher_data[U1].version, 6); assert.strictEqual(tables.teacher_data[U1].content.diary.length, 2); ok("keep-mine resolves the conflict");
  net = false; store.updateData((d) => { d.diary.push({ id: "d3" }); }); await sleep(1500);
  assert.strictEqual(tables.teacher_data[U1].content.diary.length, 2); assert.strictEqual(store.getDB().data[U1].diary.length, 3); assert.strictEqual(cloud.getCloudState().save, "error"); ok("offline edit kept locally, state = error");
  net = true; await cloud.retryNow(); await sleep(100);
  assert.strictEqual(tables.teacher_data[U1].content.diary.length, 3); assert.strictEqual(cloud.getCloudState().save, "saved"); ok("connection back + 'try again now' uploads the edit");

  console.log("2. sign-out safety");
  net = false; store.updateData((d) => { d.diary.push({ id: "d4" }); }); await sleep(100);
  answer = false; assert.strictEqual(await cloud.signOut(), false); assert.ok(store.getDB().data[U1].diary.length === 4); ok("cancel = stay signed in, nothing lost");
  answer = true; downloads = 0; assert.strictEqual(await cloud.signOut(), true);
  assert.ok(downloads >= 1); assert.strictEqual(cloud.listUnsaved(U1).length, 1);
  const rec = JSON.parse(ls[cloud.listUnsaved(U1)[0].key]); assert.strictEqual(rec.data.diary.length, 4); assert.ok(store.getDB().data.legacy01);
  ok("failed upload + sign-out: file downloaded AND recovery copy (4 diary entries) kept; old local profile untouched");
  net = true;

  console.log("3. diary record cannot be created");
  resetWorld(); delete tables.teacher_data[U1]; failInsert = true; ({ store, cloud } = fresh());
  store.mutate((x) => { x.profiles.push(prof("legacy01", "Old")); x.data.legacy01 = store.emptyData(); x.current = "legacy01"; });
  await login(cloud); let st = cloud.getCloudState();
  assert.ok(st.loadError.includes("Could not create your diary record")); assert.strictEqual(st.activeId, null); assert.ok(!store.getDB().data[U1]); assert.ok(store.getDB().data.legacy01); ok("clear error, nothing silently continued, nothing saved, old data untouched");
  failInsert = false; await cloud.retryLoad(); await sleep(60); assert.strictEqual(cloud.getCloudState().loadError, ""); assert.strictEqual(cloud.getCloudState().activeId, U1); ok("'Try again' recovers once the problem is fixed");

  console.log("4. reload while offline / unsent changes survive a reload");
  resetWorld(); ({ store, cloud } = fresh()); await login(cloud);
  store.updateData((d) => { d.diary.push({ id: "e1" }); }); await sleep(1500); assert.strictEqual(tables.teacher_data[U1].version, 1);
  net = false; store.updateData((d) => { d.diary.push({ id: "e2" }); }); await sleep(100);
  ({ store, cloud } = fresh({ keepStorage: true })); await login(cloud); st = cloud.getCloudState();
  assert.strictEqual(st.activeId, U1); assert.strictEqual(store.getDB().data[U1].diary.length, 2); ok("page reloaded with no connection: opens from this device's copy");
  net = true; await cloud.retryNow(); await sleep(100);
  assert.strictEqual(tables.teacher_data[U1].content.diary.length, 2); assert.strictEqual(tables.teacher_data[U1].version, 2); ok("connection back: unsent change uploaded (version check passed)");
  net = false; store.updateData((d) => { d.diary.push({ id: "e3" }); }); await sleep(100);
  tables.teacher_data[U1].version = 9; tables.teacher_data[U1].content = { classes: [{ id: "other-device" }] };
  ({ store, cloud } = fresh({ keepStorage: true })); net = true; await login(cloud); st = cloud.getCloudState();
  assert.strictEqual(st.save, "conflict"); assert.strictEqual(tables.teacher_data[U1].version, 9); assert.strictEqual(store.getDB().data[U1].diary.length, 3); ok("unsent change + cloud changed elsewhere: conflict shown, BOTH copies preserved");

  console.log("5. admin opening another diary");
  resetWorld(); ({ store, cloud } = fresh()); await login(cloud);
  store.updateData((d) => { d.diary.push({ id: "f1" }); }); await sleep(50); net = false;
  await assert.rejects(() => cloud.openTeacher(U2), /not saved yet/); assert.strictEqual(cloud.getCloudState().activeId, U1); ok("switching blocked while changes are unsaved");
  net = true; await cloud.retryNow(); await sleep(60); await cloud.openTeacher(U2); assert.strictEqual(cloud.getCloudState().activeId, U2); assert.strictEqual(tables.teacher_data[U1].content.diary.length, 1); ok("after saving, switching works and nothing is lost");

  console.log("6. moving old on-device data to the cloud");
  resetWorld(); ({ store, cloud } = fresh()); await login(cloud);
  const old = store.freshData(); old.diary = [{ id: "o1", absent: [] }, { id: "o2", absent: [] }]; old.classes = [{ id: "oc", name: "BBS II", subject: "B", students: "A\nB" }];
  store.mutate((x) => { x.profiles.push(prof("legacy01", "Old")); x.data.legacy01 = old; }); await sleep(1500);
  downloads = 0; let r = cloud.importLocalToCloud("legacy01"); await sleep(1500);
  assert.ok(r.ok && /2 diary entries/.test(r.msg)); assert.ok(downloads >= 1, "cloud copy downloaded first"); assert.strictEqual(tables.teacher_data[U1].content.diary.length, 2); ok("copied with a download of the previous cloud copy and a record count");
  r = cloud.importLocalToCloud("legacy01"); await sleep(1500);
  assert.strictEqual(tables.teacher_data[U1].content.diary.length, 2); assert.strictEqual(tables.teacher_data[U1].content.students.length, 2); ok("pressing it twice does not duplicate anything");
  assert.ok(store.getDB().data.legacy01.diary.length === 2); ok("old on-device copy unchanged");
  console.log(`\n${passed} checks passed (simulation only; the real Supabase is not involved).`);
  process.exit(0);
})().catch((e) => { console.error("\nFAIL:", e); process.exit(1); });
