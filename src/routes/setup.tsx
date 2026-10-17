import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Page, FormFields, Collection, Dt, NeedProfile } from "@/components/app/ui";
import { mutate, useTeacher, studentsOf } from "@/lib/store";
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
        <button className="btn mt-3" onClick={() => mutate((x) => { const i = x.profiles.findIndex((p) => p.id === profile.id); x.profiles[i] = { ...x.profiles[i], ...f }; })}>Save</button>
      </section>
      <Collection k="classes" title="Classes & students" sort={(a, b) => a.name.localeCompare(b.name)}
        fields={[
          { k: "name", l: "Class / level (e.g. BBS I Year)" }, { k: "subject", l: "Subject" },
          { k: "code", l: "Subject code (e.g. Acc 211)" }, { k: "year", l: "Academic year (e.g. 2083)" },
          { k: "totalLh", l: "Total lecture hours (LH)", t: "num" },
          { k: "students", l: "Students — one name per line (roll order)", t: "area" },
        ]}
        summary={(c) => <><b>{c.name}</b> · {c.subject} {c.code && `(${c.code})`}<div className="text-xs text-muted-foreground">{c.totalLh} LH · {studentsOf(c).length} students · {c.year}</div></>} />
      <Collection k="cal" title="Campus academic calendar"
        fields={[{ k: "type", l: "Type", t: "sel", opts: CAL_TYPES }, { k: "title", l: "Title / note" }, { k: "from", l: "From", t: "date" }, { k: "to", l: "To (blank for one day)", t: "date" }]}
        defaults={{ to: "" }}
        summary={(e) => <><b>{e.type}</b> {e.title && `— ${e.title}`}<div className="text-xs text-muted-foreground"><Dt d={e.from} />{e.to && e.to !== e.from && <> → <Dt d={e.to} /></>}</div></>} />
    </Page>
  );
}
