import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, FormFields, Collection, Dt, NeedProfile } from "@/components/app/ui";
import { mutate, updateData, useTeacher, studentsOf } from "@/lib/store";
import { weeklyOffOf } from "@/lib/migrate";
import { CAL_TYPES } from "@/lib/constants";
import { PROFILE_FIELDS } from "./profiles";

export const Route = createFileRoute("/setup")({
  head: () => ({ meta: [
    { title: "Setup — Shikshak Diary" },
    { name: "description", content: "Campus, teacher, classes, students and academic calendar setup." },
    { property: "og:title", content: "Setup — Shikshak Diary" },
    { property: "og:description", content: "Campus, teacher, classes, students and academic calendar setup." },
  ] }),
  component: Setup,
});

function Setup() {
  const { profile } = useTeacher();
  const [f, setF] = useState<Record<string, any>>({});
  useEffect(() => { if (profile) setF(profile); }, [profile?.id]);
  if (!profile) return <NeedProfile />;
  return (
    <Page title="Setup" sub="Campus, teacher, classes and the academic calendar">
      <section className="panel mb-4">
        <h2 className="mb-3 text-lg font-bold">Campus & teacher</h2>
        <FormFields fields={PROFILE_FIELDS} value={f} onChange={setF} />
        <button className="btn mt-3" onClick={() => mutate((x) => { const i = x.profiles.findIndex((p) => p.id === profile.id); x.profiles[i] = { ...x.profiles[i]!, ...f, id: profile.id }; })}>Save</button>
      </section>
      <WeeklyOff />
      <p className="no-print mb-2 text-sm text-muted-foreground">Students are managed in <Link to="/students" className="underline">Students</Link>; academic years and subject upgrades in <Link to="/years" className="underline">Academic years</Link>.</p>
      <Collection k="classes" title="Classes" sort={(a, b) => a.name.localeCompare(b.name)}
        fields={[
          { k: "name", l: "Class / level (e.g. BBS I Year)" }, { k: "subject", l: "Subject" },
          { k: "code", l: "Subject code (e.g. Acc 211)" },
          { k: "totalLh", l: "Total lecture hours (LH)", t: "num" },
        ]}
        summary={(c) => <><b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`}<div className="text-xs text-muted-foreground">{c.totalLh} LH · {studentsOf(c).length} students{c.closed && <span className="chip ml-2">closed · old subject</span>}{c.pending && <span className="chip ml-2">subject not upgraded yet</span>}</div></>} />
      <Collection k="cal" title="Campus academic calendar"
        fields={[{ k: "type", l: "Type", t: "sel", opts: CAL_TYPES }, { k: "title", l: "Title / note" }, { k: "from", l: "From", t: "date" }, { k: "to", l: "To (blank for one day)", t: "date" }]}
        defaults={{ to: "" }}
        summary={(e) => <><b>{e.type}</b> {e.title && `— ${e.title}`}<div className="text-xs text-muted-foreground"><Dt d={e.from} />{e.to && e.to !== e.from && <> → <Dt d={e.to} /></>}</div></>} />
    </Page>
  );
}

const DAYS: [string, string][] = [["Sun", "Sunday · आइतबार"], ["Mon", "Monday · सोमबार"], ["Tue", "Tuesday · मंगलबार"], ["Wed", "Wednesday · बुधबार"], ["Thu", "Thursday · बिहीबार"], ["Fri", "Friday · शुक्रबार"], ["Sat", "Saturday · शनिबार"]];

function WeeklyOff() {
  const { data } = useTeacher();
  const off = weeklyOffOf(data);
  const toggle = (d: string) => updateData((x) => {
    const cur = weeklyOffOf(x);
    x.settings = { ...x.settings, weeklyOff: cur.includes(d) ? cur.filter((y) => y !== d) : [...cur, d] };
  });
  return (
    <section className="panel no-print mb-4">
      <h2 className="mb-1 text-lg font-bold">Weekly holidays · साप्ताहिक बिदा</h2>
      <p className="mb-3 text-xs text-muted-foreground">Selected days are shaded as holidays in the monthly report and warned about when saving a diary entry.</p>
      <div className="flex flex-wrap gap-2">
        {DAYS.map(([k, l]) => (
          <label key={k} className={off.includes(k) ? "chip-on cursor-pointer" : "chip cursor-pointer"}>
            <input type="checkbox" className="mr-1.5" checked={off.includes(k)} onChange={() => toggle(k)} />{l}
          </label>
        ))}
      </div>
    </section>
  );
}
