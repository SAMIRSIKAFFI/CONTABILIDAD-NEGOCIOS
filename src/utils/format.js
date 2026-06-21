// Formato de moneda: Bs 6.000,00 (punto para miles, coma para decimales)
export function fmt(v, cur = "$") {
  const num = +v || 0;
  const formatted = num.toLocaleString("es-BO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${cur} ${formatted}`;
}

// Formato de fecha: 17/06/2026 (DD/MM/AAAA)
export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}
