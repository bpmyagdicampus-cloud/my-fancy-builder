import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type NoticeType = "general" | "urgent" | "holiday";

export type PopupNotice = {
  id: string;
  title: string;
  content: string;
  notice_type: NoticeType;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const NOTICE_META: Record<NoticeType, { label: string; icon: string; badge: string; bar: string }> = {
  general: {
    label: "सामान्य",
    icon: "📢",
    badge: "bg-primary/10 text-primary border-primary/30",
    bar: "border-primary/40",
  },
  urgent: {
    label: "जरुरी",
    icon: "🚨",
    badge: "bg-destructive/10 text-destructive border-destructive/40",
    bar: "border-destructive/50",
  },
  holiday: {
    label: "बिदा",
    icon: "🏖️",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/40 dark:text-emerald-300",
    bar: "border-emerald-500/50",
  },
};

export const noticeMeta = (t: string) => NOTICE_META[(t as NoticeType) in NOTICE_META ? (t as NoticeType) : "general"];

const key = (id: string) => `dismissed_notice_${id}`;

function wasDismissed(id: string) {
  try {
    return localStorage.getItem(key(id)) === "1";
  } catch {
    return false;
  }
}

export function GlobalNoticeModal() {
  const [notice, setNotice] = useState<PopupNotice | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // table is not in generated types yet → loose cast
        const { data, error } = await (supabase as any)
          .from("popup_notices")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled || error || !data) return;
        setNotice(data as PopupNotice);
        if (!wasDismissed(data.id)) setOpen(true);
      } catch {
        // a notice must never break the app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const close = () => {
    if (notice) {
      try {
        localStorage.setItem(key(notice.id), "1");
      } catch {
        /* storage unavailable — just close */
      }
    }
    setOpen(false);
  };

  if (!notice) return null;
  const meta = noticeMeta(notice.notice_type);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className={`max-h-[85vh] overflow-y-auto border-2 sm:max-w-lg ${meta.bar}`}>
        <DialogHeader className="text-left">
          <span
            className={`mb-1 inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${meta.badge}`}
          >
            <span aria-hidden="true">{meta.icon}</span> {meta.label}
          </span>
          <DialogTitle className="text-xl font-bold leading-snug">{notice.title}</DialogTitle>
          <DialogDescription className="sr-only">पप-अप सूचना · Popup notice</DialogDescription>
        </DialogHeader>

        <div className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
          {notice.content}
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(notice.created_at).toLocaleDateString()}
        </div>

        <DialogFooter>
          <button type="button" className="btn w-full sm:w-auto" onClick={close} autoFocus>
            बुझें / बन्द गर्नुहोस्
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
