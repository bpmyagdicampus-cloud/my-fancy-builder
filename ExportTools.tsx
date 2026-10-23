/** Office-compatible exports of the currently visible page. PDF is produced with the browser print dialog. */
export function ExportTools({ baseName = "teacher-diary-report" }: { baseName?: string }) {
  const pageHtml = () => {
    const root = document.querySelector("main");
    if (!root) throw new Error("Report content is not available.");
    const clone = root.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".no-print, button, input, select, textarea").forEach((el) => el.remove());
    clone.querySelectorAll(".print-only").forEach((el) => ((el as HTMLElement).style.display = "block"));
    return `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,'Noto Sans Devanagari',sans-serif;color:#111;font-size:11pt;margin:18px}h1,h2,h3{margin:.6em 0}table{border-collapse:collapse;width:100%;margin:10px 0}th,td{border:1px solid #777;padding:5px;vertical-align:top}th{background:#eee}p{margin:5px 0}.panel{margin:10px 0;padding:10px;border:1px solid #bbb;border-radius:6px}.chip{border:1px solid #bbb;padding:2px 4px}</style></head><body>${clone.innerHTML}</body></html>`;
  };
  const download = (format: "excel" | "word") => {
    try {
      const html = pageHtml();
      const isExcel = format === "excel";
      const blob = new Blob(["\ufeff", html], { type: isExcel ? "application/vnd.ms-excel;charset=utf-8" : "application/msword;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.${isExcel ? "xls" : "doc"}`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { alert(e instanceof Error ? e.message : String(e)); }
  };
  return <div className="no-print flex flex-wrap gap-2"><button type="button" className="btn-soft" onClick={() => download("excel")} title="Download an Excel-compatible workbook">Excel</button><button type="button" className="btn-soft" onClick={() => download("word")} title="Download a Word-compatible document">Word</button></div>;
}
