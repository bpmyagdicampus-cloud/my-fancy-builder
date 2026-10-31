import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloud } from "@/lib/cloud";
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
