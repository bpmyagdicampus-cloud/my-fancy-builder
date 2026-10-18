import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page, FormFields, type Field } from "@/components/app/ui";
import { mutate, uid, useDB, exportProfile, importProfile, emptyData } from "@/lib/store";

export const Route = createFileRoute("/profiles")({
  head: () => ({ meta: [
    { title: "Teacher Profiles — Shikshak Diary" },
    { name: "description", content: "Choose, add or back up teacher profiles." },
    { property: "og:title", content: "Teacher Profiles — Shikshak Diary" },
    { property: "og:description", content: "Choose, add or back up teacher profiles." },
  ] }),
  component: Profiles,
});

export const PROFILE_FIELDS: Field[] = [
  { k: "name", l: "Teacher's name" }, { k: "designation", l: "Designation (पद)" },
  { k: "dept", l: "Department" }, { k: "campus", l: "Campus name" }, { k: "address", l: "Campus address" },
  { k: "hod", l: "Head of department" }, { k: "chief", l: "Campus chief" },
];

function Profiles() {
  const db = useDB();
  const nav = useNavigate();
  const [f, setF] = useState<Record<string, string> | null>(null);
  const create = () => {
    if (!f?.["name"]) return alert("Enter teacher's name");
    mutate((x) => { const id = uid(); x.profiles.push({ id, name: "", designation: "", dept: "", campus: "", address: "", hod: "", chief: "", ...f }); x.data[id] = emptyData(); x.current = id; });
    nav({ to: "/" });
  };
  const download = (id: string, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportProfile(id)], { type: "application/json" }));
    a.download = `diary-${name}.json`; a.click();
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try { importProfile(await file.text()); nav({ to: "/" }); } catch (e) { alert((e as Error).message); }
  };
  return (
    <Page title="Teacher profiles" sub="Each teacher keeps a separate diary on this device. Back up regularly.">
      <div className="grid gap-3 sm:grid-cols-2">
        {db.profiles.map((p) => (
          <div key={p.id} className={`panel ${db.current === p.id ? "ring-2 ring-primary" : ""}`}>
            <div className="font-bold">{p.name}</div>
            <div className="text-sm text-muted-foreground">{p.designation} · {p.campus}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn" onClick={() => { mutate((x) => { x.current = p.id; }); nav({ to: "/" }); }}>Open</button>
              <button className="btn-soft" onClick={() => download(p.id, p.name)}>Backup</button>
              <button className="btn-danger" onClick={() => confirm(`Delete ${p.name} and all their data?`) && mutate((x) => { x.profiles = x.profiles.filter((y) => y.id !== p.id); delete x.data[p.id]; if (x.current === p.id) x.current = null; })}>Delete</button>
            </div>
          </div>
        ))}
      </div>
      <div className="panel mt-4">
        {f ? (<>
          <FormFields fields={PROFILE_FIELDS} value={f} onChange={setF as never} />
          <div className="mt-3 flex gap-2"><button className="btn" onClick={create}>Create profile</button><button className="btn-soft" onClick={() => setF(null)}>Cancel</button></div>
        </>) : (
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => setF({})}>+ New teacher</button>
            <label className="btn-soft cursor-pointer">Restore from backup<input type="file" accept=".json" className="hidden" onChange={(e) => upload(e.target.files?.[0])} /></label>
          </div>
        )}
      </div>
    </Page>
  );
}
