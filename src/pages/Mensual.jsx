import { useState } from "react";
import { useApp } from "../context/AppContext";

const fmt = (v, cur = "$") => `${cur} ${(+v || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Mensual() {
  const { config, periods, getTotalesPorPeriodo, ingresos, gastos, costos } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.key || "");

  const period = periods.find(p => p.key === selectedPeriod) || periods[0];
  const totals = period ? getTotalesPorPeriodo(period.month, period.year) : {};

  const ing = ingresos.filter(x => period && x.month === period.month && x.year === period.year);
  const gas = gastos.filter(x => period && x.month === period.month && x.year === period.year);
  const cos = costos.filter(x => period && x.month === period.month && x.year === period.year);

  const groupByCat = (arr) => {
    const map = {};
    arr.forEach(x => { if (!map[x.categoria]) map[x.categoria] = 0; map[x.categoria] += x.totalNeto || 0; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const ingCats = groupByCat(ing);
  const gasCats = groupByCat(gas);
  const cosCats = groupByCat(cos);

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">📆 Resumen Mensual</h1><p className="page-subtitle">Análisis detallado de un mes específico</p></div></div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div className="form-group" style={{ maxWidth: 240 }}>
          <label className="form-label">Seleccionar Mes</label>
          <select className="form-select" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-title">Ingresos Totales</div><div className="stat-value green">{fmt(totals.ingresosNetos || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Gastos Totales</div><div className="stat-value red">{fmt(totals.gastosTotales || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Costos Totales</div><div className="stat-value yellow">{fmt(totals.costosTotales || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Ganancia del Mes</div><div className={`stat-value ${(totals.ganancia || 0) >= 0 ? "green" : "red"}`}>{fmt(totals.ganancia || 0, config.currency)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Meta de Ganancia Mensual</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "var(--text2)" }}>Progreso</span>
              <span style={{ color: "var(--text)" }}>{fmt(totals.ganancia || 0, config.currency)} / {fmt(config.annualGoal / 12, config.currency)}</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, ((totals.ganancia || 0) / (config.annualGoal / 12 || 1)) * 100))}%` }} /></div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>{config.annualGoal > 0 ? `${Math.round(((totals.ganancia || 0) / (config.annualGoal / 12)) * 100)}% de la meta mensual` : "Configura una meta anual en Configuración"}</div>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <BarBreakdown title="Ingresos por Categoría" cats={ingCats} total={totals.ingresosNetos || 0} cur={config.currency} color="var(--accent-green)" />
        <BarBreakdown title="Gastos por Categoría" cats={gasCats} total={totals.gastosTotales || 0} cur={config.currency} color="var(--accent-red)" />
        <BarBreakdown title="Costos por Categoría" cats={cosCats} total={totals.costosTotales || 0} cur={config.currency} color="var(--accent-yellow)" />
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-title">Detalle de Transacciones — {period?.label}</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Bruto</th><th>Impuesto</th><th>Neto</th></tr></thead>
            <tbody>
              {[...ing.map(x => ({ ...x, tipo: "Ingreso", bruto: x.ingresoTotal })),
                ...gas.map(x => ({ ...x, tipo: "Gasto", bruto: x.gastoTotal })),
                ...cos.map(x => ({ ...x, tipo: "Costo", bruto: x.costoTotal }))
              ].sort((a, b) => (a.fecha||"").localeCompare(b.fecha||"")).map(item => (
                <tr key={item.id}>
                  <td><span className={`badge badge-${item.tipo === "Ingreso" ? "green" : item.tipo === "Gasto" ? "red" : "yellow"}`}>{item.tipo}</span></td>
                  <td>{item.fecha}</td><td>{item.categoria}</td><td>{item.descripcion}</td>
                  <td className="num-neutral">{fmt(item.bruto, config.currency)}</td>
                  <td>{fmt(item.valorImpuesto, config.currency)}</td>
                  <td className="num-positive">{fmt(item.totalNeto, config.currency)}</td>
                </tr>
              ))}
              {ing.length + gas.length + cos.length === 0 && (<tr><td colSpan={7}><div className="empty-state"><div className="icon">📆</div><p>Sin transacciones este mes</p></div></td></tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function BarBreakdown({ title, cats, total, cur, color }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {cats.length === 0 ? <p style={{ color: "var(--text3)", fontSize: 13 }}>Sin datos</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {cats.map(([cat, val]) => {
            const pct = total > 0 ? (val / total) * 100 : 0;
            return (
              <div key={cat}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}><span style={{ color: "var(--text2)" }}>{cat}</span><span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt(val, cur)}</span></div>
                <div className="progress-bar"><div style={{ height: "100%", borderRadius: 3, background: color, width: `${pct}%`, transition: "width 0.4s" }} /></div>
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, textAlign: "right" }}>{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
