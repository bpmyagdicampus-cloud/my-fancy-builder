import { useEffect, useState } from "react";
import { useCloud } from "@/lib/cloud";
import * as C from "@/lib/campus";

type Rec = Record<string, any>;

/** Can the signed-in user create classes in this department? (administrator, or that department's head) */
export function useCanCreate(deptId: string): boolean {
  const cl = useCloud();
  const lk = C.useLookup();
  return !!deptId && (cl.roles.includes("admin") || lk.heads.some((h) => h.user_id === cl.userId && h.department_id === deptId));
}

/** Department chooser for a class. Options come from the department records; Management is the default. */
export function DeptField({ value, onChange }: { value: Rec; onChange: (v: Rec) => void }) {
  const lk = C.useLookup();
  const def = C.findManagement(lk.departments)?.id ?? lk.departments[0]?.id ?? "";
  useEffect(() => { if (!value.deptId && def) onChange({ ...value, deptId: def }); }, [def, value.deptId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lk.departments.length) return <p className="text-sm text-muted-foreground">{lk.ready ? "No departments yet (the administrator adds them in Setup → Campus)." : "Loading…"}</p>;
  return (
    <select className="field" value={value.deptId || def} onChange={(e) => onChange({ ...value, deptId: e.target.value, name: "", centralId: "" })}>
      {lk.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
    </select>
  );
}

/**
 * Class chooser: classes of the chosen department. The administrator / department head can also create a new
 * class right here; other teachers can only pick an existing one. If the campus set-up is not available at all,
 * it falls back to a plain text box so the old behaviour keeps working.
 */
export function ClassPickField({ value, onChange }: { value: Rec; onChange: (v: Rec) => void }) {
  const lk = C.useLookup();
  const deptId: string = value.deptId || C.findManagement(lk.departments)?.id || "";
  const can = useCanCreate(deptId);
  const [nw, setNw] = useState("");
  const [msg, setMsg] = useState("");
  const list = lk.classes.filter((c) => c.department_id === deptId);

  // an older class that has a name but no link yet: link it when the department already has a class of that name
  useEffect(() => {
    if (!value.centralId && value.name && deptId) {
      const hit = lk.classes.find((c) => c.department_id === deptId && c.name.trim().toLowerCase() === String(value.name).trim().toLowerCase());
      if (hit) onChange({ ...value, deptId, centralId: hit.id });
    }
  }, [lk.classes, deptId, value.name, value.centralId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!lk.departments.length) return <input className="field" value={value.name ?? ""} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="e.g. BBS I" />;

  const create = async () => {
    const n = nw.trim();
    if (!n) return;
    const r = await C.addClass(deptId, n);
    if (!r.ok) { setMsg(r.error); return; }
    const rr = await C.refreshLookup();
    const hit = (rr.ok ? rr.data.classes : []).find((c) => c.department_id === deptId && c.name.trim().toLowerCase() === n.toLowerCase());
    onChange({ ...value, deptId, name: hit?.name ?? n, centralId: hit?.id ?? "" });
    setNw(""); setMsg("");
  };

  return (
    <div>
      <select className="field" value={value.centralId || ""} onChange={(e) => { const c = lk.classes.find((x) => x.id === e.target.value); onChange({ ...value, deptId, name: c?.name ?? "", centralId: c?.id ?? "" }); }}>
        <option value="">{value.name && !value.centralId ? `${value.name} (not linked yet)` : "— Select class —"}</option>
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      {can ? (
        <div className="mt-1 flex gap-2">
          <input className="field" placeholder="New class in this department (e.g. BBS III)" value={nw} onChange={(e) => setNw(e.target.value)} />
          <button type="button" className="btn-soft" onClick={() => void create()}>+ Create</button>
        </div>
      ) : <p className="mt-1 text-xs text-muted-foreground">Only the administrator or this department's head can create a new class. Choose an existing one.</p>}
      {msg && <p className="mt-1 text-xs text-destructive">{msg}</p>}
    </div>
  );
}

/** Small department label shown next to a class. Classes without a department belong to Management. */
export function DeptTag({ deptId }: { deptId?: string | undefined }) {
  const lk = C.useLookup();
  const d = lk.departments.find((x) => x.id === deptId) ?? (deptId ? undefined : C.findManagement(lk.departments));
  return d ? <span className="chip mr-2">{d.name}</span> : null;
}
