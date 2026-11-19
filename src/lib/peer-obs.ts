import { supabase } from "@/integrations/supabase/client";
import { getCloudState } from "./cloud";

export type PeerObsCriterion = {
  id: number;
  en: string;
  ne: string;
};

export const PEER_OBS_CRITERIA: PeerObsCriterion[] = [
  { id: 1, en: "Lesson preparation and clear objectives", ne: "पाठ तयारी र स्पष्ट उद्देश्य" },
  { id: 2, en: "Subject matter knowledge", ne: "विषयवस्तुको ज्ञान" },
  { id: 3, en: "Clarity of presentation", ne: "प्रस्तुतीकरणको स्पष्टता" },
  { id: 4, en: "Teaching methods and techniques", ne: "शिक्षण विधि तथा प्रविधि" },
  { id: 5, en: "Use of teaching materials/ICT", ne: "शिक्षण सामग्री तथा प्रविधिको प्रयोग" },
  { id: 6, en: "Student participation and interaction", ne: "विद्यार्थी सहभागिता र अन्तरक्रिया" },
  { id: 7, en: "Classroom management", ne: "कक्षा व्यवस्थापन" },
  { id: 8, en: "Time management", ne: "समय व्यवस्थापन" },
  { id: 9, en: "Questioning and feedback", ne: "प्रश्नोत्तर तथा पृष्ठपोषण" },
  { id: 10, en: "Lesson summary and achievement of objectives", ne: "पाठको निष्कर्ष र उद्देश्य प्राप्ति" },
];

export type PeerObservation = {
  id: string;
  // Section A: General Information
  teacherName: string; // शिक्षकको नाम (Observed)
  teacherId?: string;
  observerName: string; // अवलोकनकर्ताको नाम (Observer)
  observerId?: string;
  department: string; // विभाग
  className: string; // कक्षा/तह
  subject: string; // विषय
  topic: string; // पाठको शीर्षक
  date: string; // मिति (BS)
  duration: string; // समय/अवधि (e.g. ४५ मिनेट)
  studentCount: number; // विद्यार्थी संख्या

  // Section B: Classroom Observation Scores (1-5 for each of 10 criteria)
  scores: Record<number, number>; // { 1: 5, 2: 4, ... }
  totalScore: number; // Max 50
  percentage: number; // e.g. 90%
  grade: string; // A+, A, B, C, D

  // Section C: Feedback and Suggestions
  strengths: string; // पाठका सबल पक्षहरू
  areasForImprovement: string; // सुधार गर्नुपर्ने पक्षहरू
  suggestions: string; // सुधारका लागि सुझावहरू
  overallRemarks: string; // समग्र टिप्पणी

  // Section D: Confirmation
  observerDate: string;
  teacherDate: string;
  teacherAck?: string; // शिक्षकको प्रतिक्रिया
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "shikshak-peer-observations-v1";

export function calcTotalScore(scores: Record<number, number>): number {
  return PEER_OBS_CRITERIA.reduce((sum, c) => sum + (Number(scores[c.id]) || 0), 0);
}

export function calcGrade(totalScore: number): { grade: string; labelEn: string; labelNe: string; color: string } {
  const pct = Math.round((totalScore / 50) * 100);
  if (totalScore >= 45) {
    return { grade: "A+", labelEn: "Outstanding / Excellent", labelNe: "विशिष्ट / उत्कृष्ट", color: "text-emerald-700 bg-emerald-500/20" };
  }
  if (totalScore >= 40) {
    return { grade: "A", labelEn: "Very Good", labelNe: "धेरै राम्रो", color: "text-blue-700 bg-blue-500/20" };
  }
  if (totalScore >= 30) {
    return { grade: "B", labelEn: "Good", labelNe: "राम्रो", color: "text-amber-700 bg-amber-500/20" };
  }
  if (totalScore >= 20) {
    return { grade: "C", labelEn: "Satisfactory", labelNe: "सन्तोषजनक", color: "text-orange-700 bg-orange-500/20" };
  }
  return { grade: "D", labelEn: "Needs Improvement", labelNe: "सुधार आवश्यक", color: "text-rose-700 bg-rose-500/20" };
}

export function loadAllPeerObservations(): PeerObservation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function savePeerObservation(obs: PeerObservation): Promise<void> {
  const cloud = getCloudState();
  if (cloud.userId) {
    if (!obs.teacherId || !obs.observerId) throw new Error("सम्बन्धित शिक्षकलाई खाताको सूचीबाट छान्नुहोस्।");
    const { error } = await supabase.from("peer_observations").upsert({ id: obs.id, observer_id: obs.observerId, teacher_id: obs.teacherId, content: JSON.parse(JSON.stringify(obs)) }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    window.dispatchEvent(new CustomEvent("shikshak-peer-obs-changed"));
    return;
  }
  const list = loadAllPeerObservations();
  const idx = list.findIndex((x) => x.id === obs.id);
  let next: PeerObservation[];
  if (idx >= 0) {
    next = list.map((item, i) => (i === idx ? { ...obs, updatedAt: new Date().toISOString() } : item));
  } else {
    next = [{ ...obs, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...list];
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("shikshak-peer-obs-changed", { detail: obs }));
  } catch {
    /* ignore */
  }
}

export async function deletePeerObservation(id: string): Promise<void> {
  if (getCloudState().userId) {
    const { error } = await supabase.from("peer_observations").delete().eq("id", id);
    if (error) throw new Error(error.message);
    window.dispatchEvent(new CustomEvent("shikshak-peer-obs-changed"));
    return;
  }
  const list = loadAllPeerObservations();
  const next = list.filter((x) => x.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("shikshak-peer-obs-changed", { detail: { id, deleted: true } }));
  } catch {
    /* ignore */
  }
}

/** Get observations conducted by a teacher (Observer view in Records) */
export async function getObservationsByObserver(observerName: string, observerId?: string): Promise<PeerObservation[]> {
  if (getCloudState().userId && observerId) return sharedObservations("observer_id", observerId, observerName);
  const all = loadAllPeerObservations();
  const nameNorm = observerName.trim().toLowerCase();
  return all.filter(
    (o) =>
      (observerId && o.observerId === observerId) ||
      (o.observerName && o.observerName.trim().toLowerCase() === nameNorm)
  );
}

/** Get observations conducted on a teacher (Observed view in Reports) */
export async function getObservationsForTeacher(teacherName: string, teacherId?: string): Promise<PeerObservation[]> {
  if (getCloudState().userId && teacherId) return sharedObservations("teacher_id", teacherId, teacherName);
  const all = loadAllPeerObservations();
  const nameNorm = teacherName.trim().toLowerCase();
  return all.filter(
    (o) =>
      (teacherId && o.teacherId === teacherId) ||
      (o.teacherName && o.teacherName.trim().toLowerCase() === nameNorm)
  );
}

async function sharedObservations(column: "observer_id" | "teacher_id", id: string, name: string): Promise<PeerObservation[]> {
  // Publish only the signed-in observer's legacy copies, retaining the originals on this device.
  const userId = getCloudState().userId;
  if (column === "observer_id" && userId === id) {
    const legacy = loadAllPeerObservations().filter((o) => o.observerId === id && !!o.teacherId);
    if (legacy.length) {
      const { error } = await supabase.from("peer_observations").upsert(legacy.map((o) => ({ id: o.id, observer_id: id, teacher_id: o.teacherId || "", content: JSON.parse(JSON.stringify(o)) })), { onConflict: "id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
  }
  const { data, error } = await supabase.from("peer_observations").select("content").eq(column, id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const shared = (data ?? []).map((r) => r.content as unknown as PeerObservation);
  // Name fallback applies only to legacy rows lacking an ID; never match a different account by name.
  const local = loadAllPeerObservations().filter((o) => {
    const participant = column === "observer_id" ? o.observerId : o.teacherId;
    const participantName = column === "observer_id" ? o.observerName : o.teacherName;
    return participant === id || (!participant && participantName.trim().toLowerCase() === name.trim().toLowerCase());
  });
  return [...shared, ...local.filter((o) => !shared.some((s) => s.id === o.id))];
}
