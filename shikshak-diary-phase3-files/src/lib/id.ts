/** Short random id (8 chars). */
export const uid = () => {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const a = new Uint32Array(2);
    c.getRandomValues(a);
    return (a[0]!.toString(36) + a[1]!.toString(36)).padEnd(8, "0").slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
};
