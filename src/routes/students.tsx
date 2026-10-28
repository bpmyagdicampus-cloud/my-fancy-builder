import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Page, ClassSelect, NeedProfile } from "@/components/app/ui";
import { updateData, useTeacher, type Data } from "@/lib/store";
import { addStudents, classStudents, importMissing, missingNames, moveStudents, removeStudents, renameStudent, setActive, setRoll } from "@/lib/students";
import { useCloud } from "@/lib/cloud";
import { loadPeerClassSources } from "@/lib/classes";
import type { PeerStudentSource } from "@/lib/admin.functions";

const PRESELECT = "shikshak-students-cls";

export const Route = createFileRoute("/students")({
  head: () => ({ meta: [
    { title: "Upgrade Students — Shikshak Diary" },
    { name: "description", content: "Student lists, roll numbers, renaming and moving students between classes." },
    { property: "og:title", content: "Upgrade Students — Shikshak Diary" },
    { property: "og:description", content: "Student lists, roll numbers, renaming and moving students between classes." },
  ] }),
  component: Students,
});

function Students() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const [cls, setCls] = useState("");
  const [bulk, setBulk] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string; roll: number } | null>(null);
  const [moving, setMoving] = useState<string | null>(null);

  // Other teachers' subjects (and own other subjects) of the same class that have students
  const [allSources, setAllSources] = useState<PeerStudentSource[]>([]);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [selectedSourceKey, setSelectedSourceKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  // coming from Setup -> Classes -> "Students" opens this class directly
  useEffect(() => { try { const v = sessionStorage.getItem(PRESELECT); if (v) { setCls(v); sessionStorage.removeItem(PRESELECT); } } catch { /* ignore */ } }, []);

  const curClass = data.classes.find((c) => c.id === cls);
  const signedIn = cl.status === "ready" && !!cl.userId;

  // Load students from OTHER teachers' subjects (and own other subjects) of the SAME class
  useEffect(() => {
    if (!curClass) {
      setAllSources([]);
      setSelectedSourceKey("");
      setPreviewOpen(false);
      return;
    }
    let active = true;
    setLoadingPeers(true);
    void loadPeerClassSources({
      currentTeacherId: profile?.id ?? cl.userId ?? "",
      currentClassId: curClass.id,
      centralId: curClass.centralId ?? "",
      className: curClass.name,
      signedIn,
    }).then((list) => {
      if (!active) return;
      setAllSources(list);
      setLoadingPeers(false);
      const sameClassList = list.filter((x) => x.sameClass);
      const visible = sameClassList.length > 0 ? sameClassList : list;
      if (visible[0]) {
        setSelectedSourceKey((prev) => (visible.some((x) => x.key === prev) ? prev : visible[0]!.key));
      } else {
        setSelectedSourceKey("");
      }
    });
    return () => {
      active = false;
    };
  }, [curClass?.id, curClass?.centralId, curClass?.name, data.classes, data.students, signedIn, profile?.id, cl.userId]);

  if (!profile) return <NeedProfile />;
  const open = data.classes.filter((c) => !c.closed);
  const list = cls ? classStudents(data, cls, false) : [];
  const missing = cls ? missingNames(data, cls) : [];
  const run = (fn: (d: typeof data) => string | null | void) => {
    let msg: string | null | void = null;
    updateData((d) => { msg = fn(d); });
    if (msg) setNote(String(msg)); else setNote("");
  };

  const sameClassSources = allSources.filter((s) => s.sameClass);
  const visibleSources = showAllClasses || sameClassSources.length === 0 ? allSources : sameClassSources;
  const otherTeacherSources = visibleSources.filter((s) => s.isOtherTeacher);
  const myOtherSources = visibleSources.filter((s) => !s.isOtherTeacher);
  const selectedSource = visibleSources.find((s) => s.key === selectedSourceKey) ?? visibleSources[0] ?? null;

  return (
    <Page title="Upgrade Students · विद्यार्थी व्यवस्थापन र अपग्रेड" sub="Add or pull students from other teachers' subjects of the same class, rename students, or upgrade classes.">
      <div className="no-print mb-3 flex flex-wrap items-center gap-3">
        <div className="w-72">
          <label className="lbl">Select class & subject · कक्षा र विषय छान्नुहोस्</label>
          <ClassSelect active value={cls} onChange={(v) => { setCls(v); setNote(""); }} />
        </div>
      </div>
      {note && <p className="mb-3 rounded-md border border-primary p-2 text-sm">{note}</p>}
      {!cls && <p className="mb-4 text-sm text-muted-foreground">माथिबाट कक्षा र विषय छान्नुहोस् (Choose a class above to add or pull students from other teachers' subjects).</p>}

      {cls && (
        <>
          <section className="panel mb-4">
            <h2 className="mb-2 text-lg font-bold">
              Add students · विद्यार्थी थप्नुहोस् ({curClass?.name} · {curClass?.subject})
            </h2>

            {/* Pull from OTHER teachers' subjects (or own other subjects) of the SAME class */}
            <div className="mb-4 rounded-md border border-primary/40 bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-bold text-primary">
                  यही कक्षा ({curClass?.name}) को अन्य शिक्षक वा अर्को विषयबाट विद्यार्थी तान्नुहोस् · Pull from another teacher's subject of {curClass?.name}
                </div>
                {allSources.length > sameClassSources.length && (
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={showAllClasses}
                      onChange={(e) => setShowAllClasses(e.target.checked)}
                    />
                    <span>अन्य सबै कक्षाका विषयहरू पनि देखाउनुहोस् ({allSources.length})</span>
                  </label>
                )}
              </div>

              {loadingPeers ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  अन्य शिक्षकका विषयहरूमा विद्यार्थी खोज्दैछ… / Loading students from other teachers' subjects…
                </p>
              ) : visibleSources.length > 0 ? (
                <>
                  <p className="mb-2 mt-1 text-xs text-muted-foreground">
                    त्यही कक्षा पढाउने अन्य शिक्षकको विषय (वा आफ्नो अर्को विषय) छान्नुहोस्, <b>View students</b> बाट नामावली हेर्नुहोस् र <b>Pull students</b> थिचेर सिधै तान्नुहोस्:
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="field !w-auto min-w-72"
                      value={selectedSource?.key ?? ""}
                      onChange={(e) => setSelectedSourceKey(e.target.value)}
                    >
                      {otherTeacherSources.length > 0 && (
                        <optgroup label="अन्य शिक्षकका विषयहरू (Other Teachers' Subjects)">
                          {otherTeacherSources.map((s) => (
                            <option key={s.key} value={s.key}>
                              [शिक्षक: {s.teacherName}] {s.className} · {s.subject} {s.code ? `(${s.code})` : ""} — {s.students.length} students
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {myOtherSources.length > 0 && (
                        <optgroup label="मेरा अन्य विषयहरू (My Other Subjects)">
                          {myOtherSources.map((s) => (
                            <option key={s.key} value={s.key}>
                              [मेरो विषय] {s.className} · {s.subject} {s.code ? `(${s.code})` : ""} — {s.students.length} students
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      className="btn-soft"
                      onClick={() => setPreviewOpen((v) => !v)}
                    >
                      {previewOpen ? "Hide list · लुकाउनुहोस्" : `View ${selectedSource?.students.length ?? 0} students · हेर्नुहोस्`}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!selectedSource}
                      onClick={() => {
                        if (!selectedSource) return;
                        run((d) => {
                          const r = addStudents(
                            d,
                            cls,
                            selectedSource.students.map((s) => s.name)
                          );
                          return `${r.added.length} जना विद्यार्थी "${selectedSource.className} · ${selectedSource.subject}" (शिक्षक: ${selectedSource.teacherName}) बाट तानियो${r.skipped.length ? ` (${r.skipped.length} जना पहिले नै थिए)` : ""}।`;
                        });
                      }}
                    >
                      Pull {selectedSource?.students.length ?? 0} students · तान्नुहोस्
                    </button>
                  </div>

                  {previewOpen && selectedSource && (
                    <div className="mt-3 max-h-48 overflow-y-auto rounded border border-border bg-card p-2.5 text-xs">
                      <div className="mb-1.5 font-semibold text-muted-foreground">
                        {selectedSource.className} · {selectedSource.subject} (शिक्षक: {selectedSource.teacherName}) मा रहेका विद्यार्थीहरू ({selectedSource.students.length}):
                      </div>
                      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {selectedSource.students.map((st, idx) => (
                          <div key={idx} className="truncate">
                            <b>{st.roll}.</b> {st.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  यो कक्षा ({curClass?.name}) को अन्य कुनै शिक्षक वा विषयमा हाल विद्यार्थी रेकर्ड भेटिएन। तल नाम टाइप गरेर वा पेस्ट गरेर थप्न सक्नुहुन्छ।
                </p>
              )}
            </div>

            <label className="lbl">Or type / paste student names (one per line) · वा तल नाम लेखेर थप्नुहोस्:</label>
            <textarea className="field min-h-24" placeholder="One name per line" value={bulk} onChange={(e) => setBulk(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button className="btn" onClick={() => { run((d) => { const r = addStudents(d, cls, bulk.split("\n")); return `${r.added.length} added${r.skipped.length ? `; already in the class: ${r.skipped.join(", ")}` : ""}.`; }); setBulk(""); }}>Add</button>
              {missing.length > 0 && (
                <button className="btn-soft" onClick={() => confirm(`Add ${missing.length} names found in this class's attendance/marks but missing from the list?`) && run((d) => `${importMissing(d, cls).added.length} students added from old records.`)}>
                  Add {missing.length} names found in old records
                </button>
              )}
            </div>
          </section>

          <section className="panel mb-4 overflow-x-auto">
            <h2 className="mb-2 text-lg font-bold">{list.filter((s) => s.active).length} active · {list.length} total</h2>
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-muted-foreground"><th className="w-20 p-2">Roll</th><th className="p-2">Name</th><th className="p-2">Status</th><th className="w-12 p-2" /></tr></thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className={`border-b border-border align-top ${s.active ? "" : "opacity-60"}`}>
                    <td className="p-2">{editing?.id === s.id ? <input className="field !w-16" type="number" value={editing.roll} onChange={(e) => setEditing({ ...editing, roll: +e.target.value })} /> : s.roll}</td>
                    <td className="p-2">
                      {editing?.id === s.id ? (
                        <div className="flex flex-wrap gap-2">
                          <input className="field !w-64" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                          <button className="btn" onClick={() => {
                            let err: string | null = null;
                            updateData((d) => { if (editing.name.trim() !== s.name) err = renameStudent(d, s.id, editing.name); if (!err && editing.roll !== s.roll) setRoll(d, s.id, editing.roll); });
                            if (err) setNote(err); else { setNote("Saved."); setEditing(null); }
                          }}>Save</button>
                          <button className="btn-soft" onClick={() => setEditing(null)}>Cancel</button>
                        </div>
                      ) : s.name}
                      {moving === s.id && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <select className="field !w-64" value="" onChange={(e) => {
                            const to = e.target.value; if (!to) return;
                            const t = open.find((c) => c.id === to);
                            if (confirm(`Move ${s.name} to ${t?.name} · ${t?.subject}? Past attendance stays in the old class.`)) { run((d) => { const r = moveStudents(d, [s.id], to); return r.conflicts.length ? `Could not move: ${r.conflicts.join(", ")} (same name exists there).` : `${s.name} moved.`; }); setMoving(null); }
                          }}>
                            <option value="">Move to class…</option>
                            {open.filter((c) => c.id !== cls).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
                          </select>
                          <button className="btn-soft" onClick={() => setMoving(null)}>Cancel</button>
                        </div>
                      )}
                    </td>
                    <td className="p-2">{s.active ? <span className="chip">Active</span> : <span className="chip">Inactive</span>}</td>
                    <td className="p-2 text-right">
                      <Dots items={[
                        ["Edit name / roll", () => setEditing({ id: s.id, name: s.name, roll: s.roll })],
                        [s.active ? "Make inactive" : "Make active", () => run((d) => setActive(d, s.id, !s.active))],
                        ["Move to another class", () => setMoving(s.id)],
                        ["Remove", () => { if (confirm(`Do you want to permanently remove ${s.name} from this class? Use “Make inactive” if you want to keep the record.`)) run((d) => { removeStudents(d, [s.id]); return `${s.name} removed.`; }); }, true],
                      ]} />
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No students yet.</td></tr>}
              </tbody>
            </table>
          </section>

          <RemoveByRoll list={list} run={run} />
        </>
      )}

      <BulkMove run={run} />
    </Page>
  );
}

/** Move every student of one class to another class in one step. Active / inactive is never changed. */
function BulkMove({ run }: { run: (fn: (d: Data) => string | null | void) => void }) {
  const { data } = useTeacher();
  const open = data.classes.filter((c) => !c.closed);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [withInactive, setWithInactive] = useState(true);
  const src = open.find((c) => c.id === from);
  const dst = open.find((c) => c.id === to);
  const pool = data.students.filter((s) => s.classId === from && (withInactive || s.active));
  const active = pool.filter((s) => s.active).length;
  const go = () => {
    if (!src || !dst) return;
    if (src.id === dst.id) { alert("Choose two different classes."); return; }
    if (!pool.length) { alert("This class has no students to move."); return; }
    const msg = `Move ${pool.length} students (${active} active, ${pool.length - active} inactive)\nfrom ${src.name} · ${src.subject}\nto ${dst.name} · ${dst.subject}?\n\nActive / inactive stays as it is. Past attendance and marks stay in the old class.`;
    if (!confirm(msg)) return;
    const ids = pool.map((s) => s.id);
    run((d) => {
      const r = moveStudents(d, ids, dst.id);
      return `${r.moved.length} of ${ids.length} students moved to ${dst.name} · ${dst.subject}.${r.conflicts.length ? ` NOT moved (${r.conflicts.length}): ${r.conflicts.join(", ")}. The same name already exists in the new class.` : ""}`;
    });
    setFrom("");
  };
  return (
    <section className="panel no-print mt-4">
      <h2 className="mb-2 text-lg font-bold">Move a whole class (Upgrade) · एउटा कक्षाका सबै विद्यार्थी अर्को कक्षामा सार्नुहोस्</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="lbl">From class</label>
          <select className="field" value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">— Select —</option>{open.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
          </select></div>
        <div><label className="lbl">To class</label>
          <select className="field" value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">— Select —</option>{open.filter((c) => c.id !== from).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
          </select></div>
      </div>
      <label className="mt-2 block text-sm"><input type="checkbox" className="mr-1" checked={withInactive} onChange={(e) => setWithInactive(e.target.checked)} />Also move inactive students (they stay inactive)</label>
      {from && <p className="mt-1 text-xs text-muted-foreground">{pool.length} students will be moved ({active} active).</p>}
      <button className="btn mt-2" disabled={!from || !to} onClick={go}>Move all students</button>
    </section>
  );
}

/** The ⋮ menu beside every student (no extra package). */
function Dots({ items }: { items: [string, () => void, boolean?][] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details ref={ref} className="relative inline-block text-left">
      <summary className="btn-soft cursor-pointer list-none !px-2" aria-label="Options">⋮</summary>
      <div className="absolute right-0 z-20 mt-1 min-w-48 rounded-md border border-border bg-card p-1 shadow-lg">
        {items.map(([label, fn, danger]) => (
          <button key={label} className={`block w-full rounded px-3 py-2 text-left text-sm hover:bg-muted ${danger ? "text-destructive" : ""}`}
            onClick={() => { if (ref.current) ref.current.open = false; fn(); }}>{label}</button>
        ))}
      </div>
    </details>
  );
}

function parseRolls(txt: string): Set<number> {
  const out = new Set<number>();
  for (const part of txt.split(/[,\s]+/)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = +m[1]!, b = m[2] ? +m[2] : a;
    const lo = Math.min(a, b), hi = Math.min(Math.max(a, b), lo + 2000);
    for (let n = lo; n <= hi; n++) out.add(n);
  }
  return out;
}

/** Remove many wrongly added students at once, by roll number (for example: 1, 27-57). */
function RemoveByRoll({ list, run }: { list: { id: string; name: string; roll: number }[]; run: (fn: (d: Data) => string | null | void) => void }) {
  const [txt, setTxt] = useState("");
  const rolls = parseRolls(txt);
  const hit = list.filter((s) => rolls.has(s.roll));
  const go = () => {
    if (!hit.length) return;
    const shown = hit.slice(0, 12).map((s) => `${s.roll}. ${s.name}`).join("\n");
    if (!confirm(`Do you want to permanently remove ${hit.length} students from this class?\n\n${shown}${hit.length > 12 ? `\n… and ${hit.length - 12} more` : ""}\n\nThis cannot be undone. (To keep a record, use “Make inactive” instead.)`)) return;
    const ids = hit.map((s) => s.id);
    run((d) => `${removeStudents(d, ids).length} students removed.`);
    setTxt("");
  };
  return (
    <section className="panel no-print mt-4">
      <h2 className="mb-1 text-lg font-bold">Remove wrongly added students · रोल नम्बरबाट हटाउने</h2>
      <p className="mb-2 text-xs text-muted-foreground">Type the roll numbers, for example <b>1, 27-57</b>. You will see the names first and must confirm.</p>
      <div className="flex flex-wrap gap-2">
        <input className="field !w-64" placeholder="1, 27-57" value={txt} onChange={(e) => setTxt(e.target.value)} />
        <button className="btn-danger" disabled={!hit.length} onClick={go}>Remove {hit.length || ""} students</button>
      </div>
      {txt.trim() && <p className="mt-2 text-sm text-muted-foreground">{hit.length ? `Will remove: ${hit.slice(0, 8).map((s) => `${s.roll}. ${s.name}`).join(" · ")}${hit.length > 8 ? ` … +${hit.length - 8} more` : ""}` : "No student with these roll numbers in this class."}</p>}
    </section>
  );
}
