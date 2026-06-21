import { useState } from "react";
import { useApp } from "../context/AppContext";

const fmt = (v, cur = "$") => `${cur} ${(+v || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Diario() {
  const { config, ingresos, gastos, costos } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const dayIngresos = ingresos.filter(x => x.fecha === selectedDate);
  const dayGastos = gastos.filter(x => x.fecha === selectedDate);
  const dayCostos = costos.filter(x => x.fecha === selectedDate);

  const ingresosNetos = dayIngresos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const gastosTotales = dayGastos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const costosTotales = dayCostos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const ganancia = ingresosNetos - gastosTotales - costosTotales;

  const groupByCat = (arr, totalKey) => {
    const map = {};
    arr.forEach(x => {
      if (!map[x.categoria]) map[x.categoria] = { ingNeto: 0, total: 0 };
      map[x.categoria].ingNeto += x.totalNeto || 0;
      map[x.categoria].total += (x[totalKey] || 0);
    });
    return Object.entries(map).map(([cat, v]) => ({ cat, ...v }));
  };

  const ingCats = groupByCat(dayIngresos, "ingresoTotal");
  const gasCats = groupByCat(dayGastos, "gastoTotal");
  const cosCats = groupByCat(dayCostos, "costoTotal");

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">📅 Resumen Diario</h1><p className="page-subtitle">Visualiza el resumen de transacciones de un día específico</p></div></div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div className="form-group" style={{ maxWidth: 220 }}>
          <label className="form-label">Seleccionar Día</label>
          <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Resumen del Día — {selectedDate}</div>
        <div className="grid-4">
          <StatBox label="Ingresos Netos" value={fmt(ingresosNetos, config.currency)} color="green" />
          <StatBox label="Gastos Totales" value={fmt(gastosTotales, config.currency)} color="red" />
          <StatBox label="Costos Totales" value={fmt(costosTotales, config.currency)} color="yellow" />
          <StatBox label="Ganancia del Día" value={fmt(ganancia, config.currency)} color={ganancia >= 0 ? "green" : "red"} />
        </div>
      </div>

      <div className="grid-3">
        <CatTable title="Ingresos por Categoría" rows={ingCats} cur={config.currency} color="green" />
        <CatTable title="Gastos por Categoría" rows={gasCats} cur={config.currency} color="red" />
        <CatTable title="Costos por Categoría" rows={cosCats} cur={config.currency} color="yellow" />
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-title">Transacciones del Día</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...dayIngresos.map(x => ({ ...x, tipo: "Ingreso", monto: x.ingresoTotal })),
            ...dayGastos.map(x => ({ ...x, tipo: "Gasto", monto: x.gastoTotal })),
            ...dayCostos.map(x => ({ ...x, tipo: "Costo", monto: x.costoTotal }))].length === 0 ? (
            <div className="empty-state"><div className="icon">📅</div><p>No hay transacciones para este día</p></div>
          ) : [...dayIngresos.map(x => ({ ...x, tipo: "Ingreso", monto: x.ingresoTotal })),
            ...dayGastos.map(x => ({ ...x, tipo: "Gasto", monto: x.gastoTotal })),
            ...dayCostos.map(x => ({ ...x, tipo: "Costo", monto: x.costoTotal }))].map(item => (
            <div key={item.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className={`badge badge-${item.tipo === "Ingreso" ? "green" : item.tipo === "Gasto" ? "red" : "yellow"}`}>{item.tipo}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.categoria}</span>
                  <span style={{ color: "var(--text3)", fontSize: 13 }}>{item.descripcion}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(item.monto, config.currency)}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>Neto: {fmt(item.totalNeto, config.currency)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  const colors = { green: "var(--accent-green)", red: "var(--accent-red)", yellow: "var(--accent-yellow)", blue: "var(--accent)" };
  return (
    <div style={{ padding: "14px 0" }}>
      <div style={{ fontSize: 11, color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: colors[color] || "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function CatTable({ title, rows, cur, color }) {
  const colors = { green: "badge-green", red: "badge-red", yellow: "badge-yellow" };
  const total = rows.reduce((s, x) => s + x.total, 0);
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {rows.length === 0 ? <p style={{ color: "var(--text3)", fontSize: 13 }}>Sin registros</p> : (
        <table style={{ fontSize: 12, width: "100%" }}>
          <thead><tr><th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "left", fontSize: 11 }}>Categoría</th><th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "right", fontSize: 11 }}>Neto</th><th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "right", fontSize: 11 }}>Total</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.cat}>
                <td style={{ padding: "5px 0" }}><span className={`badge ${colors[color]}`}>{r.cat}</span></td>
                <td style={{ padding: "5px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.ingNeto, cur)}</td>
                <td style={{ padding: "5px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.total, cur)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid var(--border)" }}><td style={{ padding: "6px 0", fontWeight: 700 }}>Total</td><td colSpan={2} style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(total, cur)}</td></tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
