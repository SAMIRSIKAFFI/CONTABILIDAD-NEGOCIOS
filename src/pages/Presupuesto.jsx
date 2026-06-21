import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";


export default function Presupuesto() {
  const { config, periods, presupuesto, updatePresupuesto, getIngresosPorPeriodo, getGastosPorPeriodo, getCostosPorPeriodo, isReadOnly } = useApp();
  const cur = config.currency;

  const buildData = (type, categorias, getByPeriodo) => {
    return periods.map(p => {
      const items = getByPeriodo(p.month, p.year);
      const actual = items.reduce((s, x) => s + (x.totalNeto || 0), 0);
      const pres = +(((presupuesto[type] || {})["__total__"] || {})[p.key] || 0);
      return { ...p, actual, presupuestado: pres };
    });
  };

  const ingData = buildData("ingresos", config.categoriasIngresos, getIngresosPorPeriodo);
  const gasData = buildData("gastos", config.categoriasGastos, getGastosPorPeriodo);
  const cosData = buildData("costos", config.categoriasCostos, getCostosPorPeriodo);

  const totPresIng = ingData.reduce((s, x) => s + x.presupuestado, 0);
  const totActIng = ingData.reduce((s, x) => s + x.actual, 0);
  const totPresGas = gasData.reduce((s, x) => s + x.presupuestado, 0);
  const totActGas = gasData.reduce((s, x) => s + x.actual, 0);
  const totPresCos = cosData.reduce((s, x) => s + x.presupuestado, 0);
  const totActCos = cosData.reduce((s, x) => s + x.actual, 0);

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">📋 Panel de Presupuesto</h1><p className="page-subtitle">Compara presupuesto vs. real por periodo</p></div>
      </div>

      <div className="grid-3" style={{ marginBottom: 28 }}>
        <SummaryCard title="Ingresos" pres={totPresIng} actual={totActIng} cur={cur} />
        <SummaryCard title="Gastos" pres={totPresGas} actual={totActGas} cur={cur} />
        <SummaryCard title="Costos" pres={totPresCos} actual={totActCos} cur={cur} />
      </div>

      <BudgetTable title="📊 INGRESOS" type="ingresos" data={ingData} updatePresupuesto={updatePresupuesto} cur={cur} isReadOnly={isReadOnly} />
      <div style={{ marginTop: 24 }} />
      <BudgetTable title="💸 GASTOS" type="gastos" data={gasData} updatePresupuesto={updatePresupuesto} cur={cur} isReadOnly={isReadOnly} />
      <div style={{ marginTop: 24 }} />
      <BudgetTable title="🏭 COSTOS" type="costos" data={cosData} updatePresupuesto={updatePresupuesto} cur={cur} isReadOnly={isReadOnly} />
    </div>
  );
}

function SummaryCard({ title, pres, actual, cur }) {
  const variacion = actual - pres;
  const pos = variacion >= 0;
  return (
    <div className="card">
      <div className="card-title">Resumen {title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)", fontSize: 13 }}>Presupuestado</span><span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(pres, cur)}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)", fontSize: 13 }}>Actual</span><span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(actual, cur)}</span></div>
        <hr className="divider" style={{ margin: "4px 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--text3)", fontSize: 13 }}>Variación</span><span style={{ color: pos ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>{pos ? "+" : ""}{fmt(variacion, cur)}</span></div>
      </div>
    </div>
  );
}

function BudgetTable({ title, type, data, updatePresupuesto, cur, isReadOnly }) {
  const totPres = data.reduce((s, x) => s + x.presupuestado, 0);
  const totActual = data.reduce((s, x) => s + x.actual, 0);
  const totVar = totActual - totPres;

  return (
    <div className="card">
      <div className="section-title">{title} — Presupuesto vs. Real</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Periodo</th><th>Presupuesto</th><th>Real</th><th>Variación</th></tr></thead>
          <tbody>
            {data.map(row => {
              const v = row.actual - row.presupuestado;
              const pos = v >= 0;
              return (
                <tr key={row.key}>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>{row.label}</td>
                  <td>
                    <input type="number" step="0.01" min="0" className="form-input" style={{ maxWidth: 140 }} disabled={isReadOnly}
                      value={row.presupuestado}
                      onChange={e => updatePresupuesto(type, "__total__", row.key, parseFloat(e.target.value) || 0)} />
                  </td>
                  <td className="num-neutral">{fmt(row.actual, cur)}</td>
                  <td style={{ color: pos ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>{pos ? "+" : ""}{fmt(v, cur)}</td>
                </tr>
              );
            })}
            <tr style={{ background: "rgba(79,142,247,0.06)" }}>
              <td style={{ fontWeight: 700, color: "var(--text)" }}>TOTAL</td>
              <td style={{ fontWeight: 700 }}>{fmt(totPres, cur)}</td>
              <td style={{ fontWeight: 700 }} className="num-neutral">{fmt(totActual, cur)}</td>
              <td style={{ color: totVar >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700 }}>{totVar >= 0 ? "+" : ""}{fmt(totVar, cur)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
