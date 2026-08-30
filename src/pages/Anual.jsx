import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";

function downloadCSV(content, filename) {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function ExportBtn({ label, count, onClick, color }) {
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={onClick}
      disabled={count === 0}
      style={{ opacity: count === 0 ? 0.45 : 1, borderColor: color, color: color || "var(--text2)", fontSize: 12 }}
    >
      📤 {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );
}

export default function Anual() {
  const { config, periods, getTotalesPorPeriodo, ingresos, gastos, costos, taxPayments } = useApp();

  const monthlyData = periods.map(p => ({ ...p, ...getTotalesPorPeriodo(p.month, p.year) }));
  const yearActivo = periods[0]?.year || new Date().getFullYear();

  const totalIngresos      = monthlyData.reduce((s, x) => s + (x.ingresosBrutos || 0), 0);  // brutos
  const totalIngresosNetos = monthlyData.reduce((s, x) => s + (x.ingresosNetos || 0), 0);
  const totalRetencion     = monthlyData.reduce((s, x) => s + (x.retencionIngresos || 0), 0);
  const totalGastos        = monthlyData.reduce((s, x) => s + (x.gastosTotales || 0), 0);
  const totalCostos        = monthlyData.reduce((s, x) => s + (x.costosTotales || 0), 0);
  const totalImpuestosIng  = totalRetencion;

  // Impuestos realmente pagados = suma de tax_payments del año, la misma fuente que usa la pestaña Impuestos
  const impuestosPagadosReales = taxPayments
    .filter(t => (t.period_key || "").startsWith(`${yearActivo}-`))
    .reduce((s, t) => s + (t.real_paid || 0), 0);

  // Ganancia operativa = Brutos - Gastos - Costos (impuestos son obligación aparte)
  const gananciaActual = totalIngresos - totalGastos - totalCostos;
  const metaAnual      = config.annualGoal;
  const progresso      = metaAnual > 0 ? Math.min(100, (gananciaActual / metaAnual) * 100) : 0;

  let acumulado = 0;
  const cumData = monthlyData.map(m => { acumulado += m.ganancia || 0; return { ...m, acumulado }; });

  // Filtrar por año del período activo
  const ingAnio = ingresos.filter(x => x.year === yearActivo);
  const gasAnio = gastos.filter(x => x.year === yearActivo);
  const cosAnio = costos.filter(x => x.year === yearActivo);

  const n = (val) => (val || 0).toFixed(2).replace(".", ",");

  const exportDetalle = (rows, tipo, label) => {
    if (rows.length === 0) return;
    const headers = ["Tipo","Fecha","Categoría","Descripción","Método Pago","Bruto","Impuesto %","Retención (Imp.)","Total Neto","Notas"];
    const lines = [headers.join(";")];
    rows.forEach(r => {
      const bruto = r.ingresoTotal || r.gastoTotal || r.costoTotal || 0;
      lines.push([
        tipo, r.fecha, r.categoria,
        `"${(r.descripcion||"").replace(/"/g,'""')}"`,
        r.metodoPago||"", n(bruto), n(r.impuesto), n(r.valorImpuesto), n(r.totalNeto),
        `"${(r.notas||"").replace(/"/g,'""')}"`
      ].join(";"));
    });
    downloadCSV(lines.join("\n"), `Anual_${label}_${yearActivo}.csv`);
  };

  const handleExportResumen = () => {
    const headers = ["Mes","Ingresos Brutos","Retención Imp.","Ingresos Netos","Gastos Totales","Costos Totales","Ganancia","Saldo Acumulado"];
    const lines = [headers.join(";")];
    cumData.forEach(m => {
      lines.push([
        m.label,
        n(m.ingresosBrutos), n(m.retencionIngresos), n(m.ingresosNetos),
        n(m.gastosTotales), n(m.costosTotales), n(m.ganancia), n(m.acumulado),
      ].join(";"));
    });
    lines.push(["TOTAL ANUAL", n(totalIngresos), n(totalRetencion), n(totalIngresosNetos), n(totalGastos), n(totalCostos), n(gananciaActual), n(acumulado)].join(";"));
    downloadCSV(lines.join("\n"), `Resumen_Anual_${yearActivo}.csv`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Resumen Anual</h1>
          <p className="page-subtitle">Panorama completo del ejercicio fiscal</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ExportBtn label="Resumen mensual" count={cumData.length} onClick={handleExportResumen} />
          <ExportBtn label={`Ingresos`} count={ingAnio.length} color="#0d9e72"
            onClick={() => exportDetalle(ingAnio, "Ingreso", "Ingresos")} />
          <ExportBtn label={`Gastos`} count={gasAnio.length} color="#d63348"
            onClick={() => exportDetalle(gasAnio, "Gasto", "Gastos")} />
          <ExportBtn label={`Costos`} count={cosAnio.length} color="#a87c0a"
            onClick={() => exportDetalle(cosAnio, "Costo", "Costos")} />
        </div>
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <div className="card"><div className="card-title">Ingresos Brutos</div><div className="stat-value green">{fmt(totalIngresos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Gastos Totales</div><div className="stat-value red">{fmt(totalGastos, config.currency)}</div></div>
        <div className="card"><div className="card-title">Costos Totales</div><div className="stat-value yellow">{fmt(totalCostos, config.currency)}</div></div>
      </div>

      {totalRetencion > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "10px 16px", background: "rgba(249,200,70,0.10)", border: "1px solid rgba(249,200,70,0.35)", borderRadius: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16 }}>🧾</span>
          <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>Retención total de impuestos sobre ingresos:</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#a87c0a" }}>{fmt(totalRetencion, config.currency)}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>→ Ingresos netos: <strong style={{ color: "var(--accent-green)" }}>{fmt(totalIngresosNetos, config.currency)}</strong></span>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Impuestos Recolectados (Ingresos)</div>
          <div className="stat-value">{fmt(totalImpuestosIng, config.currency)}</div>
        </div>
        <div className="card">
          <div className="card-title">Impuestos Pagados (IVA, IT, RC-IVA)</div>
          <div className="stat-value" style={{ color: "var(--accent-purple)" }}>{fmt(impuestosPagadosReales, config.currency)}</div>
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>Suma de pagos reales registrados en la pestaña Impuestos</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Ganancia Actual</div>
          <div className={`stat-value ${gananciaActual >= 0 ? "green" : "red"}`}>{fmt(gananciaActual, config.currency)}</div>
          {metaAnual > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                <span style={{ color: "var(--text3)" }}>Meta Anual</span>
                <span>{fmt(metaAnual, config.currency)}</span>
              </div>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${Math.max(0, progresso)}%` }} /></div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>{progresso.toFixed(1)}% de la meta</div>
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-title">Meta Anual</div>
          <div className="stat-value blue">{fmt(metaAnual, config.currency)}</div>
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--text3)" }}>
            Faltan: <span style={{ color: gananciaActual >= metaAnual ? "var(--accent-green)" : "var(--accent-red)" }}>
              {fmt(Math.max(0, metaAnual - gananciaActual), config.currency)}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-title" style={{ margin: 0 }}>Ganancias por Mes</div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th style={{ textAlign: "right" }}>Ingresos</th>
                <th style={{ textAlign: "right" }}>Gastos</th>
                <th style={{ textAlign: "right" }}>Costos</th>
                <th style={{ textAlign: "right" }}>Ganancia</th>
                <th style={{ textAlign: "right" }}>Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              {cumData.map(m => (
                <tr key={m.key}>
                  <td style={{ fontWeight: 500, color: "var(--text)" }}>{m.label}</td>
                  <td className="num-positive" style={{ textAlign: "right" }}>{fmt(m.ingresosBrutos || 0, config.currency)}</td>
                  <td className="num-negative" style={{ textAlign: "right" }}>{fmt(m.gastosTotales || 0, config.currency)}</td>
                  <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(m.costosTotales || 0, config.currency)}</td>
                  <td style={{ color: (m.ganancia || 0) >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(m.ganancia || 0, config.currency)}</td>
                  <td style={{ color: m.acumulado >= 0 ? "var(--accent)" : "var(--accent-red)", fontWeight: 600, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(m.acumulado, config.currency)}</td>
                </tr>
              ))}
              <tr style={{ background: "rgba(79,142,247,0.07)", fontWeight: 700 }}>
                <td style={{ color: "var(--text)" }}>TOTAL ANUAL</td>
                <td className="num-positive" style={{ textAlign: "right" }}>{fmt(totalIngresos, config.currency)}</td>
                <td className="num-negative" style={{ textAlign: "right" }}>{fmt(totalGastos, config.currency)}</td>
                <td style={{ color: "var(--accent-yellow)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(totalCostos, config.currency)}</td>
                <td style={{ color: gananciaActual >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 700, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(gananciaActual, config.currency)}</td>
                <td style={{ color: "var(--accent)", fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{fmt(acumulado, config.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
