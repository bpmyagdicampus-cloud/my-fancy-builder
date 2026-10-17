import { Link } from "@tanstack/react-router";
import { useTeacher } from "@/lib/store";

const LINKS = [
  ["/", "Home"], ["/diary", "Daily Diary"], ["/plans", "Plans"], ["/records", "Records"], ["/reports", "Reports"],
] as const;

export function AppNav() {
  const { profile } = useTeacher();
  return (
    <header className="no-print sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2">
        <Link to="/" className="mr-3 font-display text-xl text-primary">शिक्षक डायरी</Link>
        <nav className="flex flex-1 flex-wrap gap-1">
          {LINKS.map(([to, l]) => (
            <Link key={to} to={to} className="tab" activeProps={{ className: "tab-on" }} activeOptions={{ exact: to === "/" }}>{l}</Link>
          ))}
        </nav>
        <Link to="/profiles" className="chip">{profile ? profile.name : "Choose teacher"}</Link>
        <Link to="/setup" className="btn">⚙ Setup</Link>
      </div>
    </header>
  );
}
