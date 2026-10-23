import { supabase } from "@/integrations/supabase/client";
import { friendly, type R } from "@/lib/sqc-data";

// Campus structure (docs/phase5/30_campus.sql). Every call runs WITH the signed-in user's login,
// so the database's row-level security decides who may see or change what — not this code.
const sb = supabase as any;

export type CampusProfile = { name: string; address: string; website: string; email: string; phone: string };
export type Department = { id: string; name: string };
export type Head = { user_id: string; department_id: string };
export type Program = { id: string; department_id: string; name: string };
export type CampusClass = { id: string; program_id: string; kind: "Year" | "Semester"; no: number; section: string };
export type CampusStudent = { id: string; class_id: string; name: string; roll: number; active: boolean; history: string[] };
export type CampusData = { profile: CampusProfile; departments: Department[]; heads: Head[]; programs: Program[]; classes: CampusClass[]; students: CampusStudent[] };

export const EMPTY_PROFILE: CampusProfile = { name: "", address: "", website: "", email: "", phone: "" };
/** Programs offered by most campuses; the administrator can add any other. */
export const SUGGESTED_PROGRAMS = ["MBS", "MA", "M.Ed", "BBS", "B.Ed", "BA", "BICTE", "BBA", "BSW", "BCA"];

export const className = (c: CampusClass, programs: Program[]) => {
  const p = programs.find((x) => x.id === c.program_id);
  return `${p?.name ?? "?"} · ${c.kind === "Year" ? `Year ${c.no}` : `Semester ${c.no}`}${c.section ? ` (${c.section})` : ""}`;
};

async function run<T>(p: PromiseLike<{ data: any; error: any }>, pick: (d: any) => T): Promise<R<T>> {
  try { const { data, error } = await p; return error ? { ok: false, error: nice(error) } : { ok: true, data: pick(data) }; }
  catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}
function nice(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (e?.code === "42P01" || /does not exist|schema cache|relation/i.test(m)) return "The Campus feature is not set up yet: ask the administrator to run docs/phase5/30_campus.sql in Supabase.";
  if (e?.code === "23505" || /duplicate key|unique/i.test(m)) return "This already exists (same name, or the same class / student is already there).";
  if (e?.code === "23503" || /foreign key/i.test(m)) return "This is still used by other items (programs, classes or students). Remove or move those first.";
  return friendly(e);
}

export async function loadCampus(): Promise<R<CampusData>> {
  try {
    const [p, d, h, g, c, s] = await Promise.all([
      sb.from("campus_profile").select("name,address,website,email,phone").eq("id", 1).maybeSingle(),
      sb.from("departments").select("id,name").order("name"),
      sb.from("department_heads").select("user_id,department_id"),
      sb.from("programs").select("id,department_id,name").order("name"),
      sb.from("campus_classes").select("id,program_id,kind,no,section").order("no"),
      sb.from("campus_students").select("id,class_id,name,roll,active,history").order("roll").limit(20000),
    ]);
    for (const r of [p, d, h, g, c]) if (r.error) return { ok: false, error: nice(r.error) };
    // students are visible only to administrators and department heads; for others the list is simply empty
    return { ok: true, data: {
      profile: { ...EMPTY_PROFILE, ...(p.data ?? {}) },
      departments: d.data ?? [], heads: h.data ?? [], programs: g.data ?? [], classes: c.data ?? [],
      students: (s.error ? [] : (s.data ?? [])).map((x: any) => ({ ...x, history: Array.isArray(x.history) ? x.history : [] })),
    } };
  } catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}

export const saveProfile = (v: CampusProfile) => run(sb.from("campus_profile").update({ ...v, updated_at: new Date().toISOString() }).eq("id", 1).select("id"), () => true);
export const addDepartment = (name: string) => run(sb.from("departments").insert({ name: name.trim() }), () => true);
export const renameDepartment = (id: string, name: string) => run(sb.from("departments").update({ name: name.trim() }).eq("id", id), () => true);
export const deleteDepartment = (id: string) => run(sb.from("departments").delete().eq("id", id), () => true);
export const setHead = (user_id: string, department_id: string, on: boolean) => on
  ? run(sb.from("department_heads").upsert({ user_id, department_id }, { onConflict: "user_id,department_id" }), () => true)
  : run(sb.from("department_heads").delete().eq("user_id", user_id).eq("department_id", department_id), () => true);
export const addProgram = (department_id: string, name: string) => run(sb.from("programs").insert({ department_id, name: name.trim() }), () => true);
export const renameProgram = (id: string, name: string) => run(sb.from("programs").update({ name: name.trim() }).eq("id", id), () => true);
export const deleteProgram = (id: string) => run(sb.from("programs").delete().eq("id", id), () => true);
export const addClass = (program_id: string, kind: "Year" | "Semester", no: number, section: string) => run(sb.from("campus_classes").insert({ program_id, kind, no, section: section.trim() }), () => true);
export const deleteClass = (id: string) => run(sb.from("campus_classes").delete().eq("id", id), () => true);

export const addStudents = (class_id: string, names: string[], startRoll: number) => {
  const rows = names.map((n) => n.trim()).filter(Boolean).map((name, i) => ({ class_id, name, roll: startRoll + i }));
  return rows.length ? run(sb.from("campus_students").upsert(rows, { onConflict: "class_id,name", ignoreDuplicates: true }), () => rows.length) : Promise.resolve<R<number>>({ ok: true, data: 0 });
};
export const updateStudent = (id: string, patch: Partial<Pick<CampusStudent, "name" | "roll" | "active" | "history">>) => run(sb.from("campus_students").update(patch).eq("id", id), () => true);
export const deleteStudent = (id: string) => run(sb.from("campus_students").delete().eq("id", id), () => true);
/** Moves students to another class (upgrade). The move is written into each student's history. */
export async function moveStudents(list: CampusStudent[], toClass: string, label: string): Promise<R<number>> {
  const day = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const s of list) {
    const r = await updateStudent(s.id, { history: [...s.history, `${day}: moved to ${label}`] });
    if (!r.ok) return r;
    const m = await run(sb.from("campus_students").update({ class_id: toClass }).eq("id", s.id), () => true);
    if (!m.ok) return { ok: false, error: `${s.name}: ${m.error}` };
    n++;
  }
  return { ok: true, data: n };
}
