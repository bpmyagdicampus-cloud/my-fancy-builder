import { useState, type ReactNode } from "react";
import { BS_MONTHS, daysInBsMonth, parseBs, bsKey, todayBs, fmtBs } from "@/lib/bs";
import { updateData, uid, useTeacher, type Data } from "@/lib/store";

export function Page({ title, sub, actions, children }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="no-print mb-5 flex flex-wrap items-end gap-3">
        <div className="flex-1">
          <h1 className="font-display text-3xl text-primary">{title}</h1>
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

export function ClassSelect({ value, onChange, all }: { value: string; onChange: (v: string) => void; all?: boolean }) {
  const { data } = useTeacher();
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {all ? <option value="">All classes</option> : <option value="">— Select class —</option>}
      {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>)}
    </select>
  );
}

/* ---------- Generic record collection ---------- */
export type Field = {
  k: string; l: string;
  t?: "text" | "area" | "num" | "date" | "time" | "sel" | "cls" | "rows";
  opts?: string[]; cols?: [string, string][]; wide?: boolean;
};
type Rec = any;

function blank(fields: Field[]): Rec {
  const o: Rec = {};
  for (const f of fields) o[f.k] = f.t === "num" ? 0 : f.t === "date" ? todayBs() : f.t === "sel" ? f.opts?.[0] : f.t === "rows" ? [] : "";
  return o;
}

export function FormFields({ fields, value, onChange }: { fields: Field[]; value: Rec; onChange: (v: Rec) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.k} className={f.t === "area" || f.t === "rows" || f.wide ? "sm:col-span-2" : ""}>
          <label className="lbl">{f.l}</label>
          {f.t === "area" ? <textarea className="field min-h-20" value={value[f.k] ?? ""} onChange={(e) => set(f.k, e.target.value)} />
          : f.t === "date" ? <BsDate value={value[f.k]} onChange={(v) => set(f.k, v)} />
          : f.t === "cls" ? <ClassSelect value={value[f.k] ?? ""} onChange={(v) => set(f.k, v)} />
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

export function Collection({ k, title, fields, summary, filter, defaults, sort }: {
  k: keyof Data; title: string; fields: Field[]; summary: (r: any) => ReactNode;
  filter?: (r: any) => boolean; defaults?: Rec; sort?: (a: any, b: any) => number;
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
        {!ed && <button className="btn" onClick={() => setEd({ ...blank(fields), ...defaults })}>+ Add</button>}
      </div>
      {ed && (
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
          <li key={r.id} className="cursor-pointer py-2 text-sm hover:bg-muted/50" onClick={() => setEd(structuredClone(r))}>{summary(r)}</li>
        ))}
        {!list.length && <li className="py-2 text-sm text-muted-foreground">No entries yet.</li>}
      </ul>
    </section>
  );
}

export function PrintHead({ title }: { title: ReactNode }) {
  const { profile } = useTeacher();
  return (
    <div className="mb-3 text-center">
      <div className="text-xl font-bold">{profile?.campus || "Campus name"}</div>
      <div className="text-sm">{profile?.address}</div>
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

export const PrintBtn = () => <button className="btn no-print" onClick={() => window.print()}>Print</button>;
export const Dt = ({ d }: { d?: string }) => <>{fmtBs(d)}</>;
export const NeedProfile = () => (
  <main className="mx-auto max-w-xl px-4 py-16 text-center">
    <p className="mb-4 text-muted-foreground">Please choose or create a teacher profile first.</p>
    <a href="/profiles" className="btn">Teacher profiles</a>
  </main>
);
