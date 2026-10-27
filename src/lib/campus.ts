import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { friendly, type R } from "@/lib/sqc-data";

// Campus set-up data (docs/phase5/30_campus.sql). Every call runs WITH the signed-in user's login,
// so the database's row-level security decides who may see or change what — not this code.
const sb = supabase as any;

export type CampusProfile = { name: string; address: string; website: string; email: string; phone: string };
export type Department = { id: string; name: string };
export type Head = { user_id: string; department_id: string };
export type CampusClass = { id: string; department_id: string; name: string };
export type CampusStudent = { id: string; class_id: string; name: string; roll: number; active: boolean; history: string[] };
export type CampusData = { profile: CampusProfile; departments: Department[]; heads: Head[]; classes: CampusClass[]; students: CampusStudent[] };

export const EMPTY_PROFILE: CampusProfile = { name: "", address: "", website: "", email: "", phone: "" };

async function run<T>(p: PromiseLike<{ data: any; error: any }>, pick: (d: any) => T): Promise<R<T>> {
  try { const { data, error } = await p; return error ? { ok: false, error: nice(error) } : { ok: true, data: pick(data) }; }
  catch (e) { return { ok: false, error: `No connection (${e instanceof Error ? e.message : e}).` }; }
}
function nice(e: any): string {
  const m = String(e?.message ?? e ?? "");
  if (e?.code === "P0001") return m; // a message written on purpose by the database function
  if (e?.code === "42P01" || /does not exist|schema cache|relation/i.test(m)) return "Campus set-up is not ready yet: the administrator must run docs/phase5/30_campus.sql in Supabase.";
  if (e?.code === "23505" || /duplicate key|unique/i.test(m)) return "This already exists (same name in the same place).";
  if (e?.code === "23503" || /foreign key/i.test(m)) return "This is still used by other items (classes or students). Remove or move those first.";
  return friendly(e);
}

export async function loadCampus(): Promise<R<CampusData>> {
  try {
    const [p, d, h, c] = await Promise.all([
      sb.from("campus_profile").select("name,address,website,email,phone").eq("id", 1).maybeSingle(),
      sb.from("departments").select("id,name").order("name"),
      sb.from("department_heads").select("user_id,department_id"),
      sb.from("setup_classes").select("id,department_id,name").order("name"),
    ]);
    for (const r of [p, d, h, c]) if (r.error) return { ok: false, error: nice(r.error) };
    return { ok: true, data: {
      profile: { ...EMPTY_PROFILE, ...(p.data ?? {}) },
      departments: d.data ?? [], heads: h.data ?? [], classes: c.data ?? [],
      students: [], // students are managed in "Upgrade Students" (each teacher's own class lists)
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

export const addClass = (department_id: string, name: string) => run(sb.from("setup_classes").insert({ department_id, name: name.trim() }), () => true);
export const renameClass = (id: string, name: string) => run(sb.from("setup_classes").update({ name: name.trim() }).eq("id", id), () => true);
/** Deletes a class only if nothing uses it (checked in the database). */
export const deleteClassSafe = (id: string) => run(sb.rpc("setup_class_delete", { _id: id }), () => true);
export const deleteClass = (id: string) => run(sb.from("setup_classes").delete().eq("id", id), () => true);

export const addStudents = (class_id: string, names: string[], startRoll: number) => {
  const rows = names.map((n) => n.trim()).filter(Boolean).map((name, i) => ({ class_id, name, roll: startRoll + i }));
  return rows.length ? run(sb.from("setup_students").upsert(rows, { onConflict: "class_id,name", ignoreDuplicates: true }), () => rows.length) : Promise.resolve<R<number>>({ ok: true, data: 0 });
};
export const updateStudent = (id: string, patch: Partial<Pick<CampusStudent, "name" | "roll" | "active" | "history">>) => run(sb.from("setup_students").update(patch).eq("id", id), () => true);
export const deleteStudent = (id: string) => run(sb.from("setup_students").delete().eq("id", id), () => true);
/** Moves students to another class (upgrade). The move is written into each student's history. */
export async function moveStudents(list: CampusStudent[], toClass: string, label: string): Promise<R<number>> {
  const day = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const s of list) {
    const m = await run(sb.from("setup_students").update({ class_id: toClass, history: [...s.history, `${day}: moved to ${label}`] }).eq("id", s.id), () => true);
    if (!m.ok) return { ok: false, error: `${s.name}: ${m.error}` };
    n++;
  }
  return { ok: true, data: n };
}

// ---- shared lookup (departments + classes) used by the Setup > Classes form ----
type Lookup = { departments: Department[]; classes: CampusClass[]; heads: Head[]; ready: boolean; failed: boolean };
let LK: Lookup = { departments: [], classes: [], heads: [], ready: false, failed: false };
const subs = new Set<() => void>();
let loading = false;
export async function refreshLookup(): Promise<R<CampusData>> {
  loading = true;
  const r = await loadCampus();
  LK = r.ok ? { departments: r.data.departments, classes: r.data.classes, heads: r.data.heads, ready: true, failed: false } : { ...LK, ready: true, failed: true };
  loading = false;
  subs.forEach((f) => f());
  return r;
}
export function useLookup(): Lookup {
  const [, tick] = useState(0);
  useEffect(() => {
    const f = () => tick((x) => x + 1);
    subs.add(f);
    if (!LK.ready && !loading) void refreshLookup();
    return () => { subs.delete(f); };
  }, []);
  return LK;
}
export const findManagement = (deps: Department[]) => deps.find((d) => d.name.trim().toLowerCase() === "management");
