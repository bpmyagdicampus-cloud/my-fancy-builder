import { Children, Fragment, cloneElement, isValidElement, type ReactNode, type ReactElement } from "react";
import { Eye, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ActionsMenu({ children, label = "More actions" }: { children: ReactNode; label?: string }) {
  return <div className="no-print shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label={label} title={label}><MoreVertical className="size-5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40" onClick={(e) => e.stopPropagation()}>{children}</DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

export function RowActions({ onView, onEdit, onDelete, label }: { onView?: () => void; onEdit?: () => void; onDelete?: () => void; label?: string }) {
  return <ActionsMenu label={label}>
    {onView && <DropdownMenuItem onSelect={onView}><Eye />View</DropdownMenuItem>}
    {onEdit && <DropdownMenuItem onSelect={onEdit}><Pencil />Edit</DropdownMenuItem>}
    {onDelete && <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={onDelete}><Trash2 />Delete</DropdownMenuItem>}
  </ActionsMenu>;
}

/** Preserve existing action handlers and visibility rules in independently built lists. */
export function ExistingActionsMenu({ children }: { children: ReactNode }) {
  const items = (nodes: ReactNode): ReactNode => Children.map(nodes, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ children?: ReactNode; className?: string }>;
    if (el.type === Fragment) return items(el.props.children);
    if (el.type !== "button") return el;
    const text = typeof el.props.children === "string" ? el.props.children.trim() : "";
    const viewing = /^(View|Open|Hide details|Details & Evidence)/i.test(text);
    return <DropdownMenuItem asChild>{cloneElement(el, {
      className: `w-full min-h-10 ${el.props.className?.includes("btn-danger") ? "text-destructive focus:text-destructive" : ""}`,
      children: viewing ? "View" : text === "×" ? "Delete" : el.props.children,
    })}</DropdownMenuItem>;
  });
  return <ActionsMenu>{items(children)}</ActionsMenu>;
}