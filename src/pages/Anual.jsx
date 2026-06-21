import { useApp } from "../context/AppContext";

const fmt = (v, cur = "$") => `${cur} ${(+v || 0).toLocaleString("es", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Anual() {
  const { config, periods, getTotalesPorPeriodo } = useApp();

  const monthlyData = periods.map(p => ({ ...p, ...getTotalesPorPeriodo(p.month, p.year) }));
  const totalIngresos = monthlyData.reduce((s, x) => s + (x.ingresosNetos || 0), 0);
  const totalGastos = monthlyData.reduce((s, x) => s + (x.gastosTotales || 0), 0);
  const totalCostos = monthlyData.reduce((s, x) => s + (x.costosTotales || 0), 0);
  const totalImpuestosIng = monthlyData.reduce((s, x) => s + (x.impuestosIngresos || 0), 0);
  const totalImpuestosGas = monthlyData.reduce((s, x) => s + (x.impuestosGastos || 0), 0);
  const gananciaActual = totalIngresos - totalGastos - totalCostos;
  const metaAnual = config.annualGoal;
  const progresso = metaAnual > 0 ? Math.min(100, (gananciaActual / metaAnual) * 100) : 0;

  let acumulado = 0;
  const cumData = monthlyData.map(m => { acumulado += m.ganancia || 0; return { ...m, acumulado }; });

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">📊 Resumen Anual</h1><p className="page-subtitle">Panorama completo del ejercicio fiscal</p></div></div>

      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-title">Ingresos Totales</div><div className="stat-value green">{fmt(totalIngresos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Gastos Totales</div><div className="stat-value red">{fmt(totalGastos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Costos Totales</div><div className="stat-value yellow">{fmt(totalCostos, config.currency)}</div></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card"><div className="card-title">Impuestos Recolectados (Ingresos)</div><div className="stat-value">{fmt(totalImpuestosIng, config.currency)}</div></div>
        <div className="card"><div className="card-title">Impuestos Pagados (Gastos)</div><div className="stat-value">{fmt(totalImpuestosGas, config.currency)}</div></div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Ganancia Actual</div>
          <div className={`stat-value ${gananciaActual >= 0 ? "green" : "red"}`}>{fmt(gananciaActual, config.currency)}</div>
          {metaAnual > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}><span style={{ color: "var(--text3)" }}>Meta Anual</span><span>{fmt(metaAnual, config.currency)}</span></div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(0, progresso)}%` }} /></div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{progresso.toFixed(1)}% de la meta</div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Meta Anual</div>
          <div className="stat-value blue">{fmt(metaAnual, config.currency)}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text3)" }}>Faltan: <span style={{ color: gananciaActual >= metaAnual ? "var(--accent-green)" : "var(--accent-red)" }}>{fmt(Math.max(0, metaAnual - gananciaActual), config.currency)}</span></div>
        </div>
      </div>

      <div className="card">
        <div className="section-title">Ganancias por Mes</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Costos</th><th>Ganancia</th><th>Saldo Acumulado</th></tr></thead>
            <tbody>
              {cumData.map(m => (
                <tr key={m.key}>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>{m.label}</td>
                  <td className="num-positive">{fmt(m.ingresosNetos || 0, config.currency)}</td>
                  <td className="num-negative">{fmt(m.gastosTotales || 0, config.currency)}</td>
                  <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums" }}>{fmt(m.costosTotales || 0, config.currency)}</td>
                  <td style={{ color: (m.ganancia || 0) >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(m.ganancia || 0, config.currency)}</td>
                  <td style={{ color: m.acumulado >= 0 ? "var(--accent)" : "var(--accent-red)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{fmt(m.acumulado, config.currency)}</td>
                </tr>
              ))}
              <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                <td style={{ color: "var(--text)" }}>TOTAL ANUAL</td>
                <td className="num-positive">{fmt(totalIngresos, config.currency)}</td>
                <td className="num-negative">{fmt(totalGastos, config.currency)}</td>
                <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums" }}>{fmt(totalCostos, config.currency)}</td>
                <td style={{ color: gananciaActual >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(gananciaActual, config.currency)}</td>
                <td style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>{fmt(acumulado, config.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
