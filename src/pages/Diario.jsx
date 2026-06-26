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

export default function Diario() {
  const { config, ingresos, gastos, costos } = useApp();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const dayIngresos = ingresos.filter(x => x.fecha === selectedDate);
  const dayGastos   = gastos.filter(x => x.fecha === selectedDate);
  const dayCostos   = costos.filter(x => x.fecha === selectedDate);

  const ingresosNetos  = dayIngresos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const gastosTotales  = dayGastos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const costosTotales  = dayCostos.reduce((s, x) => s + (x.totalNeto||0), 0);
  const ganancia       = ingresosNetos - gastosTotales - costosTotales;

  const todasTransacciones = [
    ...dayIngresos.map(x => ({ ...x, tipo: "Ingreso", bruto: x.ingresoTotal })),
    ...dayGastos.map(x => ({ ...x, tipo: "Gasto",   bruto: x.gastoTotal })),
    ...dayCostos.map(x => ({ ...x, tipo: "Costo",   bruto: x.costoTotal })),
  ].sort((a, b) => (a.tipo||"").localeCompare(b.tipo||""));

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
    downloadCSV(lines.join("\n"), `Diario_${label}_${selectedDate}.csv`);
  };

  const groupByCat = (arr, totalKey, netoKey = "totalNeto") => {
    const map = {};
    arr.forEach(x => {
      if (!map[x.categoria]) map[x.categoria] = { ingNeto: 0, total: 0 };
      map[x.categoria].ingNeto += (x[netoKey] || 0);
      map[x.categoria].total   += (x[totalKey] || 0);
    });
    return Object.entries(map).map(([cat, v]) => ({ cat, ...v }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">📅 Resumen Diario</h1>
          <p className="page-subtitle">Visualiza el resumen de transacciones de un día específico</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <div className="form-group" style={{ maxWidth: 220, marginBottom: 0 }}>
          <label className="form-label">Seleccionar Día</label>
          <input type="date" className="form-input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <ExportBtn label="Todo" count={todasTransacciones.length} onClick={() => exportRows(todasTransacciones, "Todo")} />
        <ExportBtn label="Ingresos" count={dayIngresos.length} color="#0d9e72"
          onClick={() => exportRows(dayIngresos.map(x=>({...x,tipo:"Ingreso",bruto:x.ingresoTotal})), "Ingresos")} />
        <ExportBtn label="Gastos" count={dayGastos.length} color="#d63348"
          onClick={() => exportRows(dayGastos.map(x=>({...x,tipo:"Gasto",bruto:x.gastoTotal})), "Gastos")} />
        <ExportBtn label="Costos" count={dayCostos.length} color="#a87c0a"
          onClick={() => exportRows(dayCostos.map(x=>({...x,tipo:"Costo",bruto:x.costoTotal})), "Costos")} />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Resumen del Día — {fmtDate(selectedDate)}</div>
        <div className="grid-4">
          <StatBox label="Ingresos Brutos"  value={fmt(dayIngresos.reduce((s,x)=>s+(x.ingresoTotal||0),0), config.currency)} color="green" />
          <StatBox label="Gastos Totales"   value={fmt(gastosTotales, config.currency)}  color="red" />
          <StatBox label="Costos Totales"   value={fmt(costosTotales, config.currency)}  color="yellow" />
          <StatBox label="Ganancia del Día" value={fmt(ganancia, config.currency)}        color={ganancia >= 0 ? "green" : "red"} />
        </div>
        {dayIngresos.reduce((s,x)=>s+(x.valorImpuesto||0),0) > 0 && (
          <div style={{ marginTop: 12, padding: "8px 14px", background: "rgba(249,200,70,0.10)", border: "1px solid rgba(249,200,70,0.35)", borderRadius: 8, fontSize: 12, color: "#a87c0a" }}>
            🧾 Retención de impuestos: <strong>{fmt(dayIngresos.reduce((s,x)=>s+(x.valorImpuesto||0),0), config.currency)}</strong>
            &nbsp;→ Ingresos netos: <strong style={{ color: "var(--accent-green)" }}>{fmt(ingresosNetos, config.currency)}</strong>
          </div>
        )}
      </div>

      <div className="grid-3">
        <CatTable title="Ingresos por Categoría (Bruto)" rows={groupByCat(dayIngresos, "ingresoTotal", "ingresoTotal")} cur={config.currency} color="green" />
        <CatTable title="Gastos por Categoría"           rows={groupByCat(dayGastos,   "gastoTotal",   "totalNeto")}    cur={config.currency} color="red" />
        <CatTable title="Costos por Categoría"           rows={groupByCat(dayCostos,   "costoTotal",   "totalNeto")}    cur={config.currency} color="yellow" />
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-title">Transacciones del Día</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {todasTransacciones.length === 0 ? (
            <div className="empty-state"><div className="icon">📅</div><p>No hay transacciones para este día</p></div>
          ) : todasTransacciones.map(item => (
            <div key={item.id} className="card" style={{ padding: "14px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span className={`badge badge-${item.tipo === "Ingreso" ? "green" : item.tipo === "Gasto" ? "red" : "yellow"}`}>{item.tipo}</span>
                  <span style={{ color: "var(--text)", fontWeight: 500 }}>{item.categoria}</span>
                  <span style={{ color: "var(--text3)", fontSize: 13 }}>{item.descripcion}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(item.bruto, config.currency)}</div>
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
          <thead>
            <tr>
              <th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "left", fontSize: 11 }}>Categoría</th>
              <th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "right", fontSize: 11 }}>Neto</th>
              <th style={{ padding: "6px 0", color: "var(--text3)", textAlign: "right", fontSize: 11 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.cat}>
                <td style={{ padding: "5px 0" }}><span className={`badge ${colors[color]}`}>{r.cat}</span></td>
                <td style={{ padding: "5px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.ingNeto, cur)}</td>
                <td style={{ padding: "5px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(r.total, cur)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "6px 0", fontWeight: 700 }}>Total</td>
              <td colSpan={2} style={{ padding: "6px 0", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmt(total, cur)}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
