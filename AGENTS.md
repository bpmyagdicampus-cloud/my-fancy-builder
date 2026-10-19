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

- Account-owned diary data syncs through `src/lib/cloud.ts`; `src/lib/store.ts` provides the local working copy and legacy profile backups so existing editors share one persistence interface.
- Dates are stored as Bikram Sambat strings "YYYY-MM-DD" (`src/lib/bs.ts`) so they sort and filter as plain strings.
- `nepali-date-converter` is imported via namespace with default fallback — its default export differs between SSR and browser.
- Reports use the `.rtable`, `.no-print` and `.print-only` classes from `src/styles.css` for printing via `window.print()`.
