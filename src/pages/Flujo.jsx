import { useApp } from "../context/AppContext";

const fmt = (v, cur = "$") => `${cur} ${(+v || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Flujo() {
  const { config, periods, getTotalesPorPeriodo } = useApp();

  const data = periods.map(p => {
    const t = getTotalesPorPeriodo(p.month, p.year);
    return { ...p, ingresos: t.ingresosNetos || 0, egresos: (t.gastosTotales || 0) + (t.costosTotales || 0), resultado: t.ganancia || 0 };
  });

  let acum = 0;
  const withAcum = data.map(m => { acum += m.resultado; return { ...m, acumulado: acum }; });

  const totIngresos = data.reduce((s, x) => s + x.ingresos, 0);
  const totEgresos = data.reduce((s, x) => s + x.egresos, 0);
  const totResult = data.reduce((s, x) => s + x.resultado, 0);
  const maxVal = Math.max(...data.map(x => Math.max(x.ingresos, x.egresos)), 1);

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">🌊 Flujo de Efectivo</h1><p className="page-subtitle">Análisis del flujo de caja mensual y acumulado</p></div></div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-title">Total Ingresos Netos</div><div className="stat-value green">{fmt(totIngresos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Total Egresos (Gastos + Costos)</div><div className="stat-value red">{fmt(totEgresos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Resultado Total</div><div className={`stat-value ${totResult >= 0 ? "green" : "red"}`}>{fmt(totResult, config.currency)}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">Flujo Mensual Visual</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {withAcum.map(m => (
            <div key={m.key}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: "var(--text)", fontWeight: 500, minWidth: 130 }}>{m.label}</span>
                <div style={{ display: "flex", gap: 20 }}>
                  <span style={{ color: "var(--accent-green)", fontVariantNumeric: "tabular-nums" }}>+{fmt(m.ingresos, config.currency)}</span>
                  <span style={{ color: "var(--accent-red)", fontVariantNumeric: "tabular-nums" }}>-{fmt(m.egresos, config.currency)}</span>
                  <span style={{ color: m.resultado >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>={fmt(m.resultado, config.currency)}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 60, fontSize: 11, color: "var(--text3)" }}>Ingresos</span><div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", background: "var(--accent-green)", borderRadius: 4, width: `${(m.ingresos / maxVal) * 100}%`, transition: "width 0.5s" }} /></div></div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ width: 60, fontSize: 11, color: "var(--text3)" }}>Egresos</span><div style={{ flex: 1, height: 8, background: "var(--surface)", borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", background: "var(--accent-red)", borderRadius: 4, width: `${(m.egresos / maxVal) * 100}%`, transition: "width 0.5s" }} /></div></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-title">Tabla de Flujo de Efectivo</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Periodo</th><th>Ingresos Netos</th><th>Gastos y Costos Totales</th><th>Resultado por Mes</th><th>Saldo Acumulado</th></tr></thead>
            <tbody>
              {withAcum.map(m => (
                <tr key={m.key}>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>{m.label}</td>
                  <td className="num-positive">{fmt(m.ingresos, config.currency)}</td>
                  <td className="num-negative">{fmt(m.egresos, config.currency)}</td>
                  <td style={{ color: m.resultado >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.resultado >= 0 ? "+" : ""}{fmt(m.resultado, config.currency)}</td>
                  <td style={{ color: m.acumulado >= 0 ? "var(--accent)" : "var(--accent-red)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(m.acumulado, config.currency)}</td>
                </tr>
              ))}
              <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                <td style={{ color: "var(--text)" }}>TOTALES</td>
                <td className="num-positive">{fmt(totIngresos, config.currency)}</td>
                <td className="num-negative">{fmt(totEgresos, config.currency)}</td>
                <td style={{ color: totResult >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(totResult, config.currency)}</td>
                <td style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{fmt(acum, config.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
