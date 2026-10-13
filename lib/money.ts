const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function formatMXN(cents: number) {
  return mxn.format(cents / 100);
}
