/** Users sign in with an ID (username) or a real e-mail. IDs are mapped to an internal address that never receives mail. */
export const LOGIN_DOMAIN = "shikshakdiary.app";
export const ROLES = ["admin", "teacher", "department_head", "student"] as const;
export type Role = (typeof ROLES)[number];

export const toEmail = (login: string) => {
  const s = login.trim().toLowerCase();
  return s.includes("@") ? s : `${s}@${LOGIN_DOMAIN}`;
};
export const loginOf = (email?: string | null) => {
  const e = (email ?? "").toLowerCase();
  return e.endsWith(`@${LOGIN_DOMAIN}`) ? e.slice(0, -(LOGIN_DOMAIN.length + 1)) : e;
};
/** Valid ID: 3-30 chars of a-z 0-9 . _ -  (or a normal e-mail address). */
export const validLogin = (s: string) => /^[a-z0-9._-]{3,30}$/.test(s) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
export const MIN_PASSWORD = 8;
