import { useEffect, useRef } from "react";
import { useTeacher } from "@/lib/store";
import { useCloud } from "@/lib/cloud";
import { todayBs } from "@/lib/bs";
import * as C from "@/lib/campus";
import { syncOwnLeaves } from "@/lib/leave";

/**
 * Records → Leave मा दर्ता भएका विदा स्वतः Home notification मा sync गर्छ।
 * UI छैन, केवल background sync।
 */
export function LeaveSync() {
  const { profile, data } = useTeacher();
  const cl = useCloud();
  const lk = C.useLookup();
  const lastKey = useRef("");

  const userId = cl.status === "ready" ? cl.userId : null;
  const leaves = data.leaves ?? [];
  const today = todayBs();
  const key = JSON.stringify({ userId, leaves, today, dept: profile?.dept, name: profile?.name });

  useEffect(() => {
    if (!userId || !profile || cl.localMode) return;
    if (key === lastKey.current) return;
    lastKey.current = key;

    const wanted = (profile.dept || "").trim().toLowerCase();
    const dept = lk.departments.find((d) => (d.name || "").trim().toLowerCase() === wanted);

    void syncOwnLeaves({
      userId,
      teacherName: profile.name,
      departmentId: dept?.id ?? null,
      leaves,
      today,
    }).catch(() => {
      // sync असफल भए पनि अनुप्रयोग चलिरहोस्; अर्को परिवर्तनमा फेरि प्रयास हुन्छ
      lastKey.current = "";
    });
  }, [key, userId, profile, lk.departments, cl.localMode]);

  return null;
}
