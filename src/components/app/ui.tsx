import { useEffect, useState, type ReactNode } from "react";
import { ClassPickField, DeptField } from "@/components/app/ClassFields";
import { BS_MONTHS, daysInBsMonth, parseBs, bsKey, todayBs, fmtBs, weekday } from "@/lib/bs";
import { updateData, uid, useTeacher, type ListKey } from "@/lib/store";

export function Page({
  title,
  sub,
  actions,
  children,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3.5 sm:mb-5">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl tracking-tight text-primary sm:text-3xl">{title}</h1>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
      <footer className="no-print mt-10 border-t border-border pt-4 text-center text-xs font-medium text-muted-foreground">
        © 2026 Shikshak Diary. Developed by Bishnu Acharya. All rights reserved.
      </footer>
    </main>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: [T, string][];
}) {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const urlTab = url.searchParams.get("tab");
      if (urlTab && items.some(([k]) => k === urlTab) && urlTab !== value) {
        onChange(urlTab as T);
      }
    } catch {
      /* ignore */
    }

    const handler = (e: Event) => {
      const targetTab = (e as CustomEvent).detail;
      if (targetTab && items.some(([k]) => k === targetTab)) {
        onChange(targetTab as T);
      }
    };
    window.addEventListener("shikshak-select-tab", handler);
    return () => window.removeEventListener("shikshak-select-tab", handler);
  }, [items, onChange, value]);

  return (
    <div className="no-print tabs-bar mb-4" role="tablist">
      {items.map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={value === k}
          className={value === k ? "tab-on" : "tab"}
          onClick={() => {
            onChange(k);
            try {
              const url = new URL(window.location.href);
              url.searchParams.set("tab", k);
              window.history.replaceState({}, "", url.toString());
            } catch {
              /* ignore */
            }
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

const YEARS = Array.from({ length: 21 }, (_, i) => 2075 + i);

const BS_MONTHS_SHORT_NE = [
  "बैशाख",
  "जेठ",
  "असार",
  "साउन",
  "भदौ",
  "असोज",
  "कार्तिक",
  "मंसिर",
  "पुस",
  "माघ",
  "फागुन",
  "चैत",
];

export function BsDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const v = value || todayBs();
  const { y, m0, d } = parseBs(v);
  const max = daysInBsMonth(y, m0);
  const set = (ny: number, nm: number, nd: number) =>
    onChange(bsKey(ny, nm, Math.min(nd, daysInBsMonth(ny, nm))));
  const isToday = v === todayBs();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex flex-1 items-center gap-1 rounded-lg border border-input bg-card p-1 shadow-sm">
        <span className="pl-1.5 text-xs text-primary" aria-hidden="true">
          📅
        </span>
        <select
          aria-label="BS Year"
          className="min-h-8 rounded border-0 bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
          value={y}
          onChange={(e) => set(+e.target.value, m0, d)}
        >
          {YEARS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">/</span>
        <select
          aria-label="BS Month"
          className="min-h-8 flex-1 rounded border-0 bg-transparent px-1.5 py-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
          value={m0}
          onChange={(e) => set(y, +e.target.value, d)}
        >
          {BS_MONTHS.map((n, i) => (
            <option key={n} value={i}>
              {BS_MONTHS_SHORT_NE[i]} ({n})
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">/</span>
        <select
          aria-label="BS Day"
          className="min-h-8 w-14 rounded border-0 bg-transparent px-1.5 py-1 text-center text-sm font-bold outline-none focus:ring-1 focus:ring-ring"
          value={d}
          onChange={(e) => set(y, m0, +e.target.value)}
        >
          {Array.from({ length: max }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
      </div>
      {!isToday && (
        <button
          type="button"
          className="btn-soft !min-h-9 !px-2.5 !py-1 text-xs"
          title="आजको मिति राख्नुहोस् · Set to Today"
          onClick={() => onChange(todayBs())}
        >
          आज · Today
        </button>
      )}
    </div>
  );
}

export function BsMonth({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [y = 2083, m = 1] = value.split("-").map(Number);
  return (
    <div className="inline-flex w-full items-center gap-1 rounded-lg border border-input bg-card p-1 shadow-sm">
      <span className="pl-2 text-xs text-primary" aria-hidden="true">
        🗓️
      </span>
      <select
        aria-label="BS Year"
        className="min-h-8 rounded border-0 bg-transparent px-2 py-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
        value={y}
        onChange={(e) => onChange(`${e.target.value}-${String(m).padStart(2, "0")}`)}
      >
        {YEARS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground">·</span>
      <select
        aria-label="BS Month"
        className="min-h-8 flex-1 rounded border-0 bg-transparent px-2 py-1 text-sm font-semibold outline-none focus:ring-1 focus:ring-ring"
        value={m}
        onChange={(e) => onChange(`${y}-${e.target.value.padStart(2, "0")}`)}
      >
        {BS_MONTHS.map((n, i) => (
          <option key={n} value={i + 1}>
            {BS_MONTHS_SHORT_NE[i]} ({n})
          </option>
        ))}
      </select>
    </div>
  );
}

/** `active`: for NEW entries — classes whose subject was upgraded (closed) are hidden unless already chosen. */
export function ClassSelect({
  value,
  onChange,
  all,
  active,
}: {
  value: string;
  onChange: (v: string) => void;
  all?: boolean;
  active?: boolean;
}) {
  const { data } = useTeacher();
  const open = data.classes.filter((c) => !c.closed);
  const closed = data.classes.filter((c) => c.closed && (!active || c.id === value));
  return (
    <select className="field" value={value} onChange={(e) => onChange(e.target.value)}>
      {all ? <option value="">All classes · सबै कक्षाहरू</option> : <option value="">— Select class · कक्षा छान्नुहोस् —</option>}
      {open.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} · {c.subject}
        </option>
      ))}
      {closed.length > 0 && (
        <optgroup label="Closed (old subject)">
          {closed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.subject}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

/* ---------- Generic record collection ---------- */
export type Field = {
  k: string;
  l: string;
  t?: "text" | "area" | "num" | "date" | "time" | "sel" | "cls" | "rows" | "dept" | "cpick";
  opts?: string[];
  cols?: [string, string][];
  wide?: boolean;
};
type Rec = any;

function blank(fields: Field[]): Rec {
  const o: Rec = {};
  for (const f of fields)
    o[f.k] =
      f.t === "num"
        ? 0
        : f.t === "date"
        ? todayBs()
        : f.t === "sel"
        ? f.opts?.[0]
        : f.t === "rows"
        ? []
        : "";
  return o;
}

export function FormFields({
  fields,
  value,
  onChange,
}: {
  fields: Field[];
  value: Rec;
  onChange: (v: Rec) => void;
}) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.k} className={f.t === "area" || f.t === "rows" || f.wide ? "sm:col-span-2" : ""}>
          <label className="lbl">{f.l}</label>
          {f.t === "area" ? (
            <textarea
              className="field min-h-20"
              value={value[f.k] ?? ""}
              onChange={(e) => set(f.k, e.target.value)}
            />
          ) : f.t === "date" ? (
            <BsDate value={value[f.k]} onChange={(v) => set(f.k, v)} />
          ) : f.t === "cls" ? (
            <ClassSelect active value={value[f.k] ?? ""} onChange={(v) => set(f.k, v)} />
          ) : f.t === "dept" ? (
            <DeptField value={value} onChange={onChange} />
          ) : f.t === "cpick" ? (
            <ClassPickField value={value} onChange={onChange} />
          ) : f.t === "sel" ? (
            <select
              className="field"
              value={value[f.k] ?? ""}
              onChange={(e) => set(f.k, e.target.value)}
            >
              {f.opts?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          ) : f.t === "rows" ? (
            <RowsEditor cols={f.cols!} value={value[f.k] ?? []} onChange={(v) => set(f.k, v)} />
          ) : (
            <input
              className="field"
              type={f.t === "num" ? "number" : f.t === "time" ? "time" : "text"}
              value={value[f.k] ?? ""}
              onChange={(e) => set(f.k, f.t === "num" ? Number(e.target.value) : e.target.value)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function RowsEditor({
  cols,
  value,
  onChange,
}: {
  cols: [string, string][];
  value: Rec[];
  onChange: (v: Rec[]) => void;
}) {
  const upd = (i: number, k: string, v: string) =>
    onChange(value.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-2">
      {value.map((r, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-2 sm:flex-row">
          {cols.map(([k, l]) => (
            <textarea
              key={k}
              placeholder={l}
              className="field min-h-14 flex-1"
              value={r[k] ?? ""}
              onChange={(e) => upd(i, k, e.target.value)}
            />
          ))}
          <button
            type="button"
            className="btn-danger self-end sm:self-start"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="btn-soft" onClick={() => onChange([...value, {}])}>
        + Add row
      </button>
    </div>
  );
}

export function Collection({
  k,
  title,
  fields,
  summary,
  filter,
  defaults,
  sort,
  canDelete,
  rowButtons,
  rowExtra,
  titleExtra,
}: {
  k: ListKey;
  title: string;
  fields: Field[];
  summary: (r: any) => ReactNode;
  filter?: (r: any) => boolean;
  defaults?: Rec;
  sort?: (a: any, b: any) => number;
  /** return a reason (text) to refuse deleting this entry, or null to allow it */
  canDelete?: (r: any) => string | null;
  /** show visible Edit / Delete buttons on every row */
  rowButtons?: boolean;
  /** extra buttons shown beside Edit / Delete (needs rowButtons) */
  rowExtra?: (r: any) => ReactNode;
  /** shown right after the title and the count (for example a Guide button) */
  titleExtra?: ReactNode;
}) {
  const { data } = useTeacher();
  const [ed, setEd] = useState<Rec | null>(null);
  let list = ((data[k] || []) as Rec[]).filter((x) => Boolean(x) && (filter ? filter(x) : true));
  list = [...list].sort(
    sort ?? ((a, b) => String(b?.date ?? b?.from ?? "").localeCompare(String(a?.date ?? a?.from ?? "")))
  );
  const save = () => {
    if (!ed) return;
    updateData((d) => {
      const arr = d[k] as Rec[];
      const i = arr.findIndex((x) => x.id === ed.id);
      if (i >= 0) arr[i] = ed;
      else arr.push({ ...ed, id: uid() });
    });
    setEd(null);
  };
  const del = (id: string) => {
    const row = (data[k] as Rec[]).find((x) => x.id === id);
    const why = row && canDelete ? canDelete(row) : null;
    if (why) {
      alert(why);
      return;
    }
    if (confirm("Do you want to permanently delete this?"))
      updateData((d) => {
        (d[k] as Rec[]).splice(
          (d[k] as Rec[]).findIndex((x) => x.id === id),
          1
        );
      });
    setEd(null);
  };
  return (
    <section className="panel no-print mb-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">
          {title}{" "}
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {list.length}
          </span>
          {titleExtra && <span className="ml-2 align-middle">{titleExtra}</span>}
        </h2>
        {!ed && (
          <button className="btn" onClick={() => setEd({ ...blank(fields), ...defaults })}>
            + Add
          </button>
        )}
      </div>
      {ed && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-secondary/40 p-4 shadow-sm">
          <FormFields fields={fields} value={ed} onChange={setEd} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn" onClick={save}>
              Save · सुरक्षित गर्नुहोस्
            </button>
            <button className="btn-soft" onClick={() => setEd(null)}>
              Cancel
            </button>
            {ed.id && (
              <button className="btn-danger ml-auto" onClick={() => del(ed.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
      <ul className="divide-y divide-border/70">
        {list.map((r) => (
          <li
            key={r.id}
            className="cursor-pointer rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
            onClick={() => setEd(structuredClone(r))}
          >
            {rowButtons ? (
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">{summary(r)}</div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn-soft !min-h-8 !px-2.5 !py-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEd(structuredClone(r));
                    }}
                  >
                    Edit
                  </button>
                  {rowExtra?.(r)}
                  <button
                    type="button"
                    className="btn-danger !min-h-8 !px-2.5 !py-1 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      del(r.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              summary(r)
            )}
          </li>
        ))}
        {!list.length && (
          <li className="py-6 text-center text-sm text-muted-foreground">
            अहिलेसम्म कुनै रेकर्ड थपिएको छैन (No entries yet).
          </li>
        )}
      </ul>
    </section>
  );
}

export function PrintHead({ title }: { title: ReactNode }) {
  const { profile } = useTeacher();
  return (
    <div className="mb-4 border-b-2 border-foreground/80 pb-3 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        Tribhuvan University Affiliate
      </div>
      <div className="font-display text-xl font-bold uppercase tracking-wide text-primary sm:text-2xl">
        {profile?.campus || "MYAGDI MULTIPLE CAMPUS"}
      </div>
      {profile?.address && <div className="text-xs text-muted-foreground">{profile.address}</div>}
      <div className="mt-1.5 inline-block rounded-md bg-muted/70 px-3 py-0.5 text-sm font-bold text-foreground">
        {title}
      </div>
    </div>
  );
}

export function Signatures({ roles }: { roles: [string, (string | undefined)?][] }) {
  return (
    <div className="mt-12 grid grid-cols-2 gap-6 text-center text-xs sm:flex sm:gap-8 sm:text-sm">
      {roles.map(([r, n]) => (
        <div key={r} className="flex-1 border-t border-foreground pt-1.5">
          <div className="font-bold">{r}</div>
          <div className="text-muted-foreground">{n}</div>
        </div>
      ))}
    </div>
  );
}

const ORIENT_KEY = "shikshak-print-orient";
/** Collects every report/plan table on the page (with its heading) and saves it as an Excel or Word file. */
function exportPage(kind: "xls" | "doc") {
  const seen = new Set<Element>();
  const parts: string[] = [];
  document.querySelectorAll("table.rtable").forEach((t) => {
    const box = t.closest("section") ?? t.parentElement;
    if (!box || seen.has(box)) return;
    seen.add(box);
    const copy = box.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".no-print, button, select, input, textarea").forEach((n) => n.remove());
    parts.push(copy.innerHTML);
  });
  if (!parts.length) {
    alert("Nothing to export on this page yet. Choose a class / period first so the report is shown.");
    return;
  }
  const css =
    "body{font-family:Arial,sans-serif;font-size:11pt}table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:4px;vertical-align:top}th{background:#e8edf7}h2,h3{margin:12px 0 6px}";
  const ns =
    kind === "doc"
      ? 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"'
      : 'xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"';
  const html = `<html ${ns}><head><meta charset="utf-8"><title>Shikshak Diary</title><style>${css}</style></head><body>${parts.join("<br/><br/>")}</body></html>`;
  const blob = new Blob(["\ufeff", html], {
    type: kind === "doc" ? "application/msword" : "application/vnd.ms-excel",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `shikshak-diary-${new Date().toISOString().slice(0, 10)}.${kind}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function PrintBtn() {
  const [o, setO] = useState<"portrait" | "landscape">("portrait");
  useEffect(() => {
    try {
      const s = localStorage.getItem(ORIENT_KEY);
      if (s === "landscape" || s === "portrait") setO(s);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(ORIENT_KEY, o);
    } catch {
      /* ignore */
    }
    let el = document.getElementById("shikshak-orient") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "shikshak-orient";
      document.head.appendChild(el);
    }
    el.textContent = `@media print { @page { size: A4 ${o}; margin: 10mm; } }`;
  }, [o]);
  return (
    <div className="no-print flex flex-wrap items-center gap-1.5">
      <select
        aria-label="Page orientation"
        className="field !w-auto !py-1.5 text-xs"
        value={o}
        onChange={(e) => setO(e.target.value as "portrait" | "landscape")}
      >
        <option value="portrait">Portrait (ठाडो)</option>
        <option value="landscape">Landscape (तेर्सो)</option>
      </select>
      <button type="button" className="btn !py-1.5 text-xs" onClick={() => window.print()}>
        🖨️ Print / PDF
      </button>
      <button type="button" className="btn-soft !py-1.5 text-xs" onClick={() => exportPage("xls")}>
        📊 Excel
      </button>
      <button type="button" className="btn-soft !py-1.5 text-xs" onClick={() => exportPage("doc")}>
        📄 Word
      </button>
    </div>
  );
}

export function Dt({ d }: { d?: string }) {
  if (!d) return <span>—</span>;
  try {
    const formatted = fmtBs(d);
    const day = weekday(d);
    return (
      <span>
        {formatted}{day ?  : ""}
      </span>
    );
  } catch {
    return <span>{d || "—"}</span>;
  }
}

export function NeedProfile() {
  return (
    <Page title="Welcome to Shikshak Diary · शिक्षक डायरीमा स्वागत छ">
      <div className="panel text-center py-8">
        <p className="mb-4 text-muted-foreground">
          तपाइँको शिक्षक प्रोफाइल छनोट वा निर्माण गरेर सुरु गर्नुहोस्।
        </p>
        <a href="/profiles" className="btn">
          Choose or create teacher profile →
        </a>
      </div>
    </Page>
  );
}
