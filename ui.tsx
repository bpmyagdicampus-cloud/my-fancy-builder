import { useEffect, useState, type ReactNode } from "react";
import { BS_MONTHS, daysInBsMonth, parseBs, bsKey, todayBs, fmtBs } from "@/lib/bs";
import { updateData, uid, useTeacher, type ListKey } from "@/lib/store";

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="no-print mb-4 flex flex-wrap items-end gap-3 sm:mb-5">
        <div className="flex-1">
          <h1 className="font-display text-2xl text-primary sm:text-3xl">{title}</h1>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: [T, string][] }) {
  return (
    <div className="no-print mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
      {items.map(([k, l]) => (
        <button key={k} className={value === k ? "tab-on" : "tab"} onClick={() => onChange(k)}>{l}</button>
      ))}
    </div>
  );
}

const YEARS = Array.from({ length: 21 }, (_, i) => 2075 + i);

export function BsDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = value || todayBs();
  const { y, m0, d } = parseBs(v);
  const max = daysInBsMonth(y, m0);
  const set = (ny: number, nm: number, nd: number) => onChange(bsKey(ny, nm, Math.min(nd, daysInBsMonth(ny, nm))));
  return (
    <div className="flex gap-1">
      <select className="field" value={y} onChange={(e) => set(+e.target.value, m0, d)}>
        {YEARS.map((n) => <option key={n}>{n}</option>)}
      </select>
      <select className="field" value={m0} onChange={(e) => set(y, +e.target.value, d)}>
        {BS_MONTHS.map((n, i) => <option key={n} value={i}>{n}</option>)}
      </select>
      <select className="field w-20" value={d} onChange={(e) => set(y, m0, +e.target.value)}>
        {Array.from({ length: max }, (_, i) => <option key={i + 1}>{i + 1}</option>)}
      </select>
    </div>
  );
}

export function BsMonth({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y = 2083, m = 1] = value.split("-").map(Number);
  return (
    <div className="flex gap-1">
      <select className="field" value={y} onChange={(e) => onChange(`${e.target.value}-${String(m).padStart(2, "0")}`)}>
        {YEARS.map((n) => <option key={n}>{n}</option>)}
      </select>
      <select className="field" value={m} onChange={(e) => onChange(`${y}-${e.target.value.padStart(2, "0")}`)}>
        {BS_MONTHS.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
      </select>
    </div>
  );
}

/** `active`: for NEW entries — classes whose subject was upgraded (closed) are hidden unless already chosen. */
export function ClassSelect({ value, onChange, all, active }: { value: string; onChange: (v: string) => void; all?: boolean; active?: boolean }) {
  const { data } = useTeacher();
  const open = data.classes.filter((c) => !c.closed);
  const closed = data.classes.filter((c) => c.closed && (!active || c.id === value));
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {all ? <option value="">All classes</option> : <option value="">— Select class —</option>}
      {open.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
      {closed.length > 0 && <optgroup label="Closed (old subject)">{closed.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}</optgroup>}
    </select>
  );
}

/* ---------- Generic record collection ---------- */
export type Field = {
  k: string; l: string;
  t?: "text" | "area" | "num" | "date" | "time" | "sel" | "cls" | "rows" | "department" | "program" | "programYear" | "semester" | "subject";
  opts?: string[]; cols?: [string, string][]; wide?: boolean;
};
type Rec = any;

function blank(fields: Field[]): Rec {
  const o: Rec = {};
  for (const f of fields) o[f.k] = f.t === "num" ? 0 : f.t === "date" ? todayBs() : f.t === "sel" ? f.opts?.[0] : f.t === "rows" ? [] : "";
  return o;
}

export function FormFields({ fields, value, onChange }: { fields: Field[]; value: Rec; onChange: (v: Rec) => void }) {
  const { data } = useTeacher();
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.k} className={f.t === "area" || f.t === "rows" || f.wide ? "sm:col-span-2" : ""}>
          <label className="lbl">{f.l}</label>
          {f.t === "area" ? <textarea className="field min-h-20" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} />
          : f.t === "date" ? <BsDate value={value[f.k]} onChange={(v) => set(f.k, v)} />
          : f.t === "cls" ? <ClassSelect active value={value[f.k] ?? ""} onChange={(v) => set(f.k, v)} />
          : f.t === "department" ? (
            <select className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}>
              <option value="">— Select department —</option>{data.departments.filter((d) => d.active !== false).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>)
          : f.t === "program" ? (
            <select className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}>
              <option value="">— Select program —</option>{data.programs.filter((p) => p.active !== false && (!value.departmentId || p.departmentId === value.departmentId)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>)
          : f.t === "subject" ? (() => {
            const program = data.programs.find((p) => p.id === value.programId);
            const subjects = (program?.subjects ?? "").split("\n").map((x) => x.trim()).filter(Boolean);
            if (!subjects.length) return <input className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} placeholder="Add subject names in program setup first" />;
            return <select className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}><option value="">— Select subject —</option>{subjects.map((o) => <option key={o}>{o}</option>)}</select>;
          })()
          : f.t === "programYear" || f.t === "semester" ? (() => {
            const program = data.programs.find((p) => p.id === value.programId);
            const isSemester = program?.structure === "Semester";
            const n = Math.max(1, Math.min(12, Number(program?.duration ?? 4)));
            const opts = program ? Array.from({ length: n }, (_, i) => `${isSemester ? "Semester" : "Year"} ${i + 1}`) : [];
            const labelOpts = f.t === "semester" ? opts.filter((o) => o.startsWith("Semester")) : opts.filter((o) => o.startsWith("Year"));
            return <select className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}><option value="">— Select {f.t === "semester" ? "semester" : "program year"} —</option>{labelOpts.map((o) => <option key={o}>{o}</option>)}</select>;
          })()
          : f.t === "sel" ? (
            <select className="field" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)}>
              {f.opts?.map((o) => <option key={o}>{o}</option>)}
            </select>)
          : f.t === "rows" ? <RowsEditor cols={f.cols!} value={value[f.k] ?? []} onChange={(v) => set(f.k, v)} />
          : <input className="field" type={f.t === "num" ? "number" : f.t === "time" ? "time" : "text"} value={value[f.k] ?? ""}
              onChange={(e) => set(f.k, f.t === "num" ? Number(e.target.value) : e.target.value)} />}
        </div>
      ))}
    </div>
  );
}

function RowsEditor({ cols, value, onChange }: { cols: [string, string][]; value: Rec[]; onChange: (v: Rec[]) => void }) {
  const upd = (i: number, k: string, v: string) => onChange(value.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div key={i} className="flex gap-2">
          {cols.map(([k, l]) => <textarea key={k} placeholder={l} className="field min-h-14 flex-1" value={r[k] ?? ""} onChange={(e) => upd(i, k, e.target.value)} />)}
          <button type="button" className="btn-danger self-start" onClick={() => onChange(value.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="btn-soft" onClick={() => onChange([...value, {}])}>+ Add row</button>
    </div>
  );
}

export function Collection({ k, title, fields, summary, filter, defaults, sort, readOnly = false }: {
  k: ListKey; title: string; fields: Field[]; summary: (r: any) => ReactNode;
  filter?: (r: any) => boolean; defaults?: Rec; sort?: (a: any, b: any) => number; readOnly?: boolean;
}) {
  const { data } = useTeacher();
  const [ed, setEd] = useState<Rec | null>(null);
  let list = (data[k] as Rec[]).filter(filter ?? (() => true));
  list = [...list].sort(sort ?? ((a, b) => String(b.date ?? b.from ?? "").localeCompare(String(a.date ?? a.from ?? ""))));
  const save = () => {
    if (!ed) return;
    updateData((d) => {
      const arr = d[k] as Rec[];
      const i = arr.findIndex((x) => x.id === ed.id);
      if (i >= 0) arr[i] = ed; else arr.push({ ...ed, id: uid() });
    });
    setEd(null);
  };
  const del = (id: string) => { if (confirm("Delete this entry?")) updateData((d) => { (d[k] as Rec[]).splice((d[k] as Rec[]).findIndex((x) => x.id === id), 1); }); setEd(null); };
  return (
    <section className="panel no-print mb-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 text-lg font-bold">{title} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
        {!ed && !readOnly && <button className="btn" onClick={() => setEd({ ...blank(fields), ...defaults })}>+ Add</button>}
      </div>
      {ed && !readOnly && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-secondary/40 p-3">
          <FormFields fields={fields} value={ed} onChange={setEd} />
          <div className="mt-3 flex gap-2">
            <button className="btn" onClick={save}>Save</button>
            <button className="btn-soft" onClick={() => setEd(null)}>Cancel</button>
            {ed.id && <button className="btn-danger ml-auto" onClick={() => del(ed.id)}>Delete</button>}
          </div>
        </div>
      )}
      <ul className="divide-y divide-border">
        {list.map((r) => (
          <li key={r.id} className={`${readOnly ? "" : "cursor-pointer hover:bg-muted/50"} py-2 text-sm`} onClick={() => !readOnly && setEd(structuredClone(r))}>{summary(r)}</li>
        ))}
        {!list.length && <li className="py-2 text-sm text-muted-foreground">No entries yet.</li>}
      </ul>
    </section>
  );
}

export function PrintHead({ title }: { title: ReactNode }) {
  const { profile, data } = useTeacher();
  const institution = data.settings.institution;
  return (
    <div className="mb-3 text-center">
      <div className="text-xl font-bold">{institution?.name || profile?.campus || "Campus name"}</div>
      <div className="text-sm">{institution?.address || profile?.address}</div>
      <div className="mt-1 font-semibold">{title}</div>
    </div>
  );
}

export function Signatures({ roles }: { roles: [string, (string | undefined)?][] }) {
  return (
    <div className="mt-12 flex gap-8 text-center text-sm">
      {roles.map(([r, n]) => (
        <div key={r} className="flex-1 border-t border-foreground pt-1"><div className="font-semibold">{r}</div><div>{n}</div></div>
      ))}
    </div>
  );
}

const ORIENT_KEY = "shikshak-print-orient";
export function PrintBtn() {
  const [o, setO] = useState<"portrait" | "landscape">("portrait");
  useEffect(() => { try { const v = localStorage.getItem(ORIENT_KEY); if (v === "landscape" || v === "portrait") setO(v); } catch { /* ignore */ } }, []);
  const choose = (v: "portrait" | "landscape") => { setO(v); try { localStorage.setItem(ORIENT_KEY, v); } catch { /* ignore */ } };
  const print = () => {
    let s = document.getElementById("print-page-style") as HTMLStyleElement | null;
    if (!s) { s = document.createElement("style"); s.id = "print-page-style"; document.head.appendChild(s); }
    s.textContent = `@page { size: A4 ${o}; margin: 12mm; }`;
    window.print();
  };
  return (
    <div className="no-print flex items-center gap-2">
      <select className="field w-44" value={o} onChange={(e) => choose(e.target.value as "portrait" | "landscape")} aria-label="Page orientation">
        <option value="portrait">Portrait · ठाडो</option>
        <option value="landscape">Landscape · तेर्सो</option>
      </select>
      <button className="btn" onClick={print}>Print / Save PDF</button>
    </div>
  );
}
export const Dt = ({ d }: { d?: string }) => <>{fmtBs(d)}</>;
export const NeedProfile = () => (
  <main className="mx-auto max-w-xl px-4 py-16 text-center">
    <p className="mb-4 text-muted-foreground">Please choose or create a teacher profile first.</p>
    <a href="/profiles" className="btn">Teacher profiles</a>
  </main>
);
