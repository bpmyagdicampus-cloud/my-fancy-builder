import { supabase } from "@/integrations/supabase/client";
import { listPeerClassStudents, type PeerStudentSource, type Result } from "./admin.functions";
import { getDB, studentsOf, type Data } from "./store";
import { classStudents } from "./students";

const sb = supabase as any;

const LABEL: Record<string, string> = {
  students: "students", diary: "diary entries", plans: "plans", units: "units", lessons: "lessons", blended: "blended lesson plans",
  assess: "assessments / marks", acts: "activities", reminders: "reminders", leaves: "leave records", cal: "calendar events",
};

/**
 * What is already recorded against a class (this year and earlier years).
 * An empty list means the class has no other data and can be deleted safely.
 */
export function classDataSummary(d: Data, id: string): string[] {
  const hits: string[] = [];
  const count = (v: unknown) => (Array.isArray(v) ? v.filter((x: any) => x && x.classId === id).length : 0);
  for (const [k, v] of Object.entries(d)) {
    if (k === "classes" || k === "years" || k === "settings" || k === "archive") continue;
    const n = count(v);
    if (n) hits.push(`${n} ${LABEL[k] ?? k}`);
  }
  for (const a of Object.values(d.archive ?? {})) {
    for (const [k, v] of Object.entries(a ?? {})) {
      if (k === "classes") continue;
      const n = count(v);
      if (n) hits.push(`${n} ${LABEL[k] ?? k} (earlier year)`);
    }
  }
  if (d.students.some((s) => s.history?.includes(id)) && !hits.some((h) => h.includes("students"))) hits.push("students who studied here earlier");
  const c = d.classes.find((x) => x.id === id);
  if (c && !hits.some((h) => h.includes("students")) && studentsOf(c).length) hits.push(`${studentsOf(c).length} students`);
  return hits;
}

/**
 * Normalizes class names so "BBS I", "BBS-I", "bbs 1st year", "BBS 1" all match as the same class.
 */
export function normClassName(s?: string): string {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[-_./()]/g, " ")
    .replace(/\b(1st|first|i)\b/g, "1")
    .replace(/\b(2nd|second|ii)\b/g, "2")
    .replace(/\b(3rd|third|iii)\b/g, "3")
    .replace(/\b(4th|fourth|iv)\b/g, "4")
    .replace(/\b(year|yr|sem|semester|part)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Loads all subjects/classes that have students across:
 * 1. All teachers in the cloud via server function `listPeerClassStudents`
 * 2. All teachers in the cloud via Supabase RPC `peer_class_students` (fallback if service role key is not set)
 * 3. Direct Supabase `teacher_data` query (works for Admins)
 * 4. All teacher profiles stored on this device (`getDB().data`)
 *
 * Places OTHER TEACHERS' subjects of the same class FIRST!
 */
export async function loadPeerClassSources(opts: {
  currentTeacherId: string;
  currentClassId?: string;
  centralId?: string;
  className?: string;
  signedIn: boolean;
}): Promise<PeerStudentSource[]> {
  const { currentTeacherId, currentClassId = "", centralId = "", className = "", signedIn } = opts;
  const targetCentral = centralId.trim();
  const targetNorm = normClassName(className);

  const byClassId = new Map<string, PeerStudentSource>();

  const addCandidate = (src: PeerStudentSource) => {
    if (!src.classId || src.classId === currentClassId || src.students.length === 0) return;
    const isOtherTeacher = src.teacherId !== currentTeacherId;
    const matchCentral = Boolean(targetCentral && src.centralId && src.centralId === targetCentral);
    const matchName = Boolean(targetNorm && normClassName(src.className) === targetNorm);
    const sameClass = matchCentral || matchName;
    const enriched: PeerStudentSource = {
      ...src,
      isOtherTeacher,
      sameClass,
    };
    const existing = byClassId.get(src.classId);
    if (!existing || (existing.teacherName === "Teacher" && src.teacherName !== "Teacher")) {
      byClassId.set(src.classId, enriched);
    }
  };

  // 1. Check all profiles stored in local browser DB (includes current teacher and any other teacher profiles on this device)
  const localDb = getDB();
  for (const [profId, profData] of Object.entries(localDb.data ?? {})) {
    const prof = localDb.profiles.find((p) => p.id === profId);
    const tName = prof?.name || "Teacher";
    for (const c of profData.classes ?? []) {
      if (!c || c.closed || c.id === currentClassId) continue;
      let stu = classStudents(profData, c.id, true).map((s) => ({ name: s.name, roll: s.roll }));
      if (stu.length === 0 && c.students) {
        stu = studentsOf(c).map((name, i) => ({ name, roll: i + 1 }));
      }
      if (stu.length === 0) continue;
      addCandidate({
        key: `${profId}:${c.id}`,
        teacherId: profId,
        teacherName: tName,
        classId: c.id,
        centralId: c.centralId ?? "",
        className: c.name,
        subject: c.subject || "Subject",
        code: c.code || "",
        students: stu,
      });
    }
  }

  if (signedIn) {
    // Run all 3 cloud strategies in parallel so whichever succeeds provides the other teachers' classes!
    await Promise.all([
      // Strategy A: Server Function (uses supabaseAdmin service_role)
      (async () => {
        try {
          const r = (await (listPeerClassStudents as any)({
            data: { centralId: targetCentral, className, excludeClassId: currentClassId },
          })) as Result<{ sources: PeerStudentSource[] }>;
          if (r?.ok && Array.isArray(r.sources)) {
            for (const s of r.sources) addCandidate(s);
          }
        } catch {
          /* ignore */
        }
      })(),

      // Strategy B: Supabase RPC `peer_class_students` (SECURITY DEFINER in PostgreSQL)
      (async () => {
        try {
          const { data, error } = await sb.rpc("peer_class_students");
          if (!error && Array.isArray(data)) {
            for (const row of data) {
              let stu: { name: string; roll: number }[] = Array.isArray(row.students)
                ? row.students.filter((s: any) => s && String(s.name ?? "").trim())
                : [];
              if (stu.length === 0 && typeof row.raw_students === "string" && row.raw_students.trim()) {
                stu = row.raw_students
                  .split("\n")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
                  .map((name: string, i: number) => ({ name, roll: i + 1 }));
              }
              if (stu.length === 0) continue;
              addCandidate({
                key: `${row.teacher_id}:${row.class_id}`,
                teacherId: String(row.teacher_id),
                teacherName: String(row.teacher_name || "Teacher"),
                classId: String(row.class_id),
                centralId: String(row.central_id ?? ""),
                className: String(row.class_name ?? ""),
                subject: String(row.subject || "Subject"),
                code: String(row.code ?? ""),
                students: stu,
              });
            }
          }
        } catch {
          /* ignore */
        }
      })(),

      // Strategy C: Direct table query (succeeds for Admins or whenever RLS permits)
      (async () => {
        try {
          const [tdRes, profRes] = await Promise.all([
            sb.from("teacher_data").select("teacher_id,content"),
            sb.from("profiles").select("id,name"),
          ]);
          if (!tdRes.error && Array.isArray(tdRes.data)) {
            const nameMap = new Map<string, string>();
            for (const p of (profRes.data ?? []) as any[]) {
              if (p?.id) nameMap.set(String(p.id), String(p.name || "Teacher"));
            }
            for (const row of tdRes.data as any[]) {
              const tId = String(row.teacher_id);
              const tName = nameMap.get(tId) || "Teacher";
              const content = row.content ?? {};
              const classes = Array.isArray(content.classes) ? content.classes : [];
              const allStudents = Array.isArray(content.students) ? content.students : [];
              for (const c of classes) {
                if (!c || c.closed || String(c.id) === currentClassId) continue;
                let stu: { name: string; roll: number }[] = allStudents
                  .filter((s: any) => s && s.classId === c.id && s.active !== false && String(s.name ?? "").trim())
                  .map((s: any, idx: number) => ({ name: String(s.name).trim(), roll: Number(s.roll) || idx + 1 }))
                  .sort((a: { roll: number; name: string }, b: { roll: number; name: string }) => a.roll - b.roll || a.name.localeCompare(b.name));
                if (stu.length === 0 && typeof c.students === "string" && c.students.trim()) {
                  stu = c.students
                    .split("\n")
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                    .map((name: string, idx: number) => ({ name, roll: idx + 1 }));
                }
                if (stu.length === 0) continue;
                addCandidate({
                  key: `${tId}:${c.id}`,
                  teacherId: tId,
                  teacherName: tName,
                  classId: String(c.id),
                  centralId: String(c.centralId ?? ""),
                  className: String(c.name ?? ""),
                  subject: String(c.subject || "Subject"),
                  code: String(c.code ?? ""),
                  students: stu,
                });
              }
            }
          }
        } catch {
          /* ignore */
        }
      })(),
    ]);
  }

  // Sort: Same class first -> Other teachers first -> Class name -> Subject
  return [...byClassId.values()].sort((a, b) => {
    if (Boolean(a.sameClass) !== Boolean(b.sameClass)) return a.sameClass ? -1 : 1;
    if (Boolean(a.isOtherTeacher) !== Boolean(b.isOtherTeacher)) return a.isOtherTeacher ? -1 : 1;
    return a.className.localeCompare(b.className) || a.subject.localeCompare(b.subject);
  });
}
