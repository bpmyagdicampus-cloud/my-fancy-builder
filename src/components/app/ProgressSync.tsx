import { useEffect, useMemo, useRef } from "react";
import { useTeacher } from "@/lib/store";
import { useCloud } from "@/lib/cloud";
import { currentYear } from "@/lib/years";
import * as C from "@/lib/campus";
import { buildOwnProgress, syncOwnProgress } from "@/lib/progress-sync";

/** शिक्षकको कक्षा-प्रगति विभाग प्रमुखका लागि पृष्ठभूमिमा sync गर्छ (UI छैन) */
export function ProgressSync() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const lastKey = useRef("");

  const userId = cl.status === "ready" ? cl.userId : null;
  const yearName = cl.activeYear?.name ?? currentYear(data)?.name ?? "";
  const wanted = (profile?.dept || "").trim().toLowerCase();
  const deptId = lk.departments.find((d) => (d.name || "").trim().toLowerCase() === wanted)?.id ?? null;

  const rows = useMemo(
    () =>
      userId && profile && yearName
        ? buildOwnProgress({ data, userId, teacherName: profile.name, departmentId: deptId, yearName })
        : [],
    [data, userId, profile, yearName, deptId]
  );

  useEffect(() => {
    if (!userId || !yearName || cl.localMode) return;
    // updated_at बाहेक सामग्री परिवर्तन भएमा मात्र sync
    const key = JSON.stringify(rows.map(({ updated_at, ...r }) => r));
    if (key === lastKey.current) return;
    lastKey.current = key;
    void syncOwnProgress(userId, yearName, rows).catch(() => {
      lastKey.current = "";
    });
  }, [rows, userId, yearName, cl.localMode]);

  return null;
}
