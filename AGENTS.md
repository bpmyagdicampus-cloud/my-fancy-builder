<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Project rules

- All app data lives in browser localStorage via `src/lib/store.ts`, keyed per teacher profile — the user chose device-only storage, so no backend is used.
- Dates are stored as Bikram Sambat strings "YYYY-MM-DD" (`src/lib/bs.ts`) so they sort and filter as plain strings.
- `nepali-date-converter` is imported via namespace with default fallback — its default export differs between SSR and browser.
- Reports use the `.rtable`, `.no-print` and `.print-only` classes from `src/styles.css` for printing via `window.print()`.
