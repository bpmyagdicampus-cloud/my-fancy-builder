import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function EntryDetails({ title, open, onClose, onEdit, children }: {
  title: string;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="pr-6 break-words">{title}</DialogTitle></DialogHeader>
        {children}
        <div className="flex flex-wrap justify-end gap-2">
          {onEdit && <Button onClick={onEdit}>Edit · सम्पादन</Button>}
          <Button variant="secondary" onClick={onClose}>Close · बन्द गर्नुहोस्</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DetailFields({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid gap-3 sm:grid-cols-2">
    {items.map(([label, value]) => <div key={label} className="min-w-0 border-b border-border pb-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value ?? "—"}</dd>
    </div>)}
  </dl>;
}