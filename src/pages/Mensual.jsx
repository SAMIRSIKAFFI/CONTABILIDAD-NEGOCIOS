import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";

function downloadCSV(content, filename) {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Mensual() {
  const { config, periods, getTotalesPorPeriodo, ingresos, gastos, costos } = useApp();
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const defaultKey = periods.find(p => p.key === currentKey)?.key || periods[0]?.key || "";
  const [selectedPeriod, setSelectedPeriod] = useState(defaultKey);

  const period  = periods.find(p => p.key === selectedPeriod) || periods[0];
  const totals  = period ? getTotalesPorPeriodo(period.month, period.year) : {};

  const ing = ingresos.filter(x => period && x.month === period.month && x.year === period.year);
  const gas = gastos.filter(x => period && x.month === period.month && x.year === period.year);
  const cos = costos.filter(x => period && x.month === period.month && x.year === period.year);

  const groupByCat = (arr, amountKey = "totalNeto") => {
    const map = {};
    arr.forEach(x => { if (!map[x.categoria]) map[x.categoria] = 0; map[x.categoria] += x[amountKey] || 0; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const todasTransacciones = [
    ...ing.map(x => ({ ...x, tipo: "Ingreso", bruto: x.ingresoTotal })),
    ...gas.map(x => ({ ...x, tipo: "Gasto",   bruto: x.gastoTotal })),
    ...cos.map(x => ({ ...x, tipo: "Costo",   bruto: x.costoTotal })),
  ].sort((a, b) => (a.fecha||"").localeCompare(b.fecha||""));

  const n = (val) => (val || 0).toFixed(2).replace(".", ",");

  const exportRows = (rows, label) => {
    if (rows.length === 0) return;
    const headers = ["Tipo","Fecha","Categoría","Descripción","Método Pago","Bruto","Impuesto %","Retención (Imp.)","Total Neto","Notas"];
    const lines = [headers.join(";")];
    rows.forEach(r => {
      lines.push([
        r.tipo, r.fecha, r.categoria,
        `"${(r.descripcion||"").replace(/"/g,'""')}"`,
        r.metodoPago||"", n(r.bruto), n(r.impuesto), n(r.valorImpuesto), n(r.totalNeto),
        `"${(r.notas||"").replace(/"/g,'""')}"`
      ].join(";"));
    });
    downloadCSV(lines.join("\n"), `Mensual_${label}_${selectedPeriod}.csv`);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📆 Resumen Mensual</h1>
          <p className="page-subtitle">Análisis detallado de un mes específico</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="form-group" style={{ maxWidth: 240, marginBottom: 0 }}>
          <label className="form-label">Seleccionar Mes</label>
          <select className="form-select" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}>
            {periods.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </div>
        <ExportBtn label="Todo" count={todasTransacciones.length} onClick={() => exportRows(todasTransacciones, "Todo")} />
        <ExportBtn label="Ingresos" count={ing.length} color="#0d9e72"
          onClick={() => exportRows(ing.map(x=>({...x,tipo:"Ingreso",bruto:x.ingresoTotal})), "Ingresos")} />
        <ExportBtn label="Gastos" count={gas.length} color="#d63348"
          onClick={() => exportRows(gas.map(x=>({...x,tipo:"Gasto",bruto:x.gastoTotal})), "Gastos")} />
        <ExportBtn label="Costos" count={cos.length} color="#a87c0a"
          onClick={() => exportRows(cos.map(x=>({...x,tipo:"Costo",bruto:x.costoTotal})), "Costos")} />
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <div className="card"><div className="card-title">Ingresos Brutos</div><div className="stat-value green">{fmt(totals.ingresosBrutos || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Gastos Totales</div><div className="stat-value red">{fmt(totals.gastosTotales || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Costos Totales</div><div className="stat-value yellow">{fmt(totals.costosTotales || 0, config.currency)}</div></div>
        <div className="card"><div className="card-title">Ganancia del Mes</div><div className={`stat-value ${(totals.ganancia || 0) >= 0 ? "green" : "red"}`}>{fmt(totals.ganancia || 0, config.currency)}</div></div>
      </div>

      {/* Casilla de retención */}
      {(totals.retencionIngresos || 0) > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, padding: "10px 16px", background: "rgba(249,200,70,0.10)", border: "1px solid rgba(249,200,70,0.35)", borderRadius: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 16 }}>🧾</span>
          <span style={{ fontSize: 13, color: "var(--text2)", fontWeight: 600 }}>Retención de impuestos sobre ingresos:</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#a87c0a" }}>{fmt(totals.retencionIngresos, config.currency)}</span>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>→ Ingresos netos después de retención: <strong style={{ color: "var(--accent-green)" }}>{fmt(totals.ingresosNetos || 0, config.currency)}</strong></span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Meta de Ganancia Mensual</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "var(--text2)" }}>Progreso</span>
              <span style={{ color: "var(--text)" }}>{fmt(totals.ganancia || 0, config.currency)} / {fmt(config.annualGoal / 12, config.currency)}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, ((totals.ganancia || 0) / (config.annualGoal / 12 || 1)) * 100))}%` }} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 6 }}>
              {config.annualGoal > 0 ? `${Math.round(((totals.ganancia || 0) / (config.annualGoal / 12)) * 100)}% de la meta mensual` : "Configura una meta anual en Configuración"}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <BarBreakdown title="Ingresos por Categoría (Bruto)" cats={groupByCat(ing, "ingresoTotal")} total={totals.ingresosBrutos || 0} cur={config.currency} color="var(--accent-green)" />
        <BarBreakdown title="Gastos por Categoría"           cats={groupByCat(gas, "totalNeto")}    total={totals.gastosTotales || 0} cur={config.currency} color="var(--accent-red)" />
        <BarBreakdown title="Costos por Categoría"           cats={groupByCat(cos, "totalNeto")}    total={totals.costosTotales || 0} cur={config.currency} color="var(--accent-yellow)" />
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-title">Detalle de Transacciones — {period?.label}</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th><th>Fecha</th><th>Categoría</th><th>Descripción</th>
                <th style={{ textAlign: "right" }}>Bruto</th>
                <th style={{ textAlign: "right" }}>Retención</th>
                <th style={{ textAlign: "right" }}>Total Neto</th>
              </tr>
            </thead>
            <tbody>
              {todasTransacciones.map(item => (
                <tr key={item.id}>
                  <td><span className={`badge badge-${item.tipo === "Ingreso" ? "green" : item.tipo === "Gasto" ? "red" : "yellow"}`}>{item.tipo}</span></td>
                  <td>{fmtDate(item.fecha)}</td>
                  <td>{item.categoria}</td>
                  <td>{item.descripcion}</td>
                  <td className="num-neutral" style={{ textAlign: "right" }}>{fmt(item.bruto, config.currency)}</td>
                  <td style={{ textAlign: "right" }}>{fmt(item.valorImpuesto, config.currency)}</td>
                  <td className="num-positive" style={{ textAlign: "right" }}>{fmt(item.totalNeto, config.currency)}</td>
                </tr>
              ))}
              {todasTransacciones.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state"><div className="icon">📆</div><p>Sin transacciones este mes</p></div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--text2)" }}>{cat}</span>
                  <span style={{ color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{fmt(val, cur)}</span>
                </div>
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
