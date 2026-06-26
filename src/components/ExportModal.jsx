import { useState, useMemo } from "react";
import { fmt, fmtDate } from "../utils/format";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const n = (val) => (val || 0).toFixed(2).replace(".", ",");

function toCSV(rows, tipo) {
  const amountKey = tipo === "ingreso" ? "ingresoTotal" : tipo === "gasto" ? "gastoTotal" : "costoTotal";
  const amountLabel = tipo === "ingreso" ? "Ingreso Bruto" : tipo === "gasto" ? "Gasto Total" : "Costo Total";
  const headers = ["Fecha","Categoría","Descripción","Método Pago", amountLabel, "Impuesto %","Retención (Imp.)","Total Neto","Notas"];
  const lines = [headers.join(";")];
  rows.forEach(r => {
    lines.push([
      r.fecha, r.categoria, `"${(r.descripcion||"").replace(/"/g,'""')}"`,
      r.metodoPago||"", n(r[amountKey]), n(r.impuesto), n(r.valorImpuesto), n(r.totalNeto),
      `"${(r.notas||"").replace(/"/g,'""')}"`
    ].join(";"));
  });
  return lines.join("\n");
}

function downloadCSV(content, filename) {
  const bom = "﻿"; // BOM para que Excel abra bien caracteres especiales
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ExportModal({ tipo, data, categorias, metodosPago, currency, onClose }) {
  const now = new Date();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [mesFilter, setMesFilter] = useState("");
  const [anioFilter, setAnioFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [metodoFilter, setMetodoFilter] = useState("");

  // Años disponibles en los datos
  const anios = useMemo(() => {
    const set = new Set(data.map(x => x.year).filter(Boolean));
    return [...set].sort((a, b) => b - a);
  }, [data]);

  // Filtrado
  const filtered = useMemo(() => {
    return data.filter(r => {
      if (fechaDesde && r.fecha < fechaDesde) return false;
      if (fechaHasta && r.fecha > fechaHasta) return false;
      if (mesFilter && r.month !== parseInt(mesFilter)) return false;
      if (anioFilter && r.year !== parseInt(anioFilter)) return false;
      if (catFilter && r.categoria !== catFilter) return false;
      if (metodoFilter && r.metodoPago !== metodoFilter) return false;
      return true;
    });
  }, [data, fechaDesde, fechaHasta, mesFilter, anioFilter, catFilter, metodoFilter]);

  const amountKey = tipo === "ingreso" ? "ingresoTotal" : tipo === "gasto" ? "gastoTotal" : "costoTotal";
  const totalFiltrado = filtered.reduce((s, x) => s + (x[amountKey] || 0), 0);
  const netoFiltrado  = filtered.reduce((s, x) => s + (x.totalNeto || 0), 0);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const label = tipo === "ingreso" ? "Ingresos" : tipo === "gasto" ? "Gastos" : "Costos";
    const fecha = new Date().toISOString().split("T")[0];
    const csv = toCSV(filtered, tipo);
    downloadCSV(csv, `${label}_exportacion_${fecha}.csv`);
  };

  const limpiar = () => {
    setFechaDesde(""); setFechaHasta(""); setMesFilter("");
    setAnioFilter(""); setCatFilter(""); setMetodoFilter("");
  };

  const label = tipo === "ingreso" ? "Ingresos" : tipo === "gasto" ? "Gastos" : "Costos";
  const color = tipo === "ingreso" ? "#0d9e72" : tipo === "gasto" ? "#d63348" : "#a87c0a";

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 className="modal-title">📤 Exportar {label}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          {/* Filtros */}
          <div style={{ background: "var(--bg3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
              Filtros de exportación
            </div>

            {/* Rango de fechas */}
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Fecha desde</label>
                <input className="form-input" type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha hasta</label>
                <input className="form-input" type="date" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
              </div>
            </div>

            {/* Mes y Año */}
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Mes específico</label>
                <select className="form-select" value={mesFilter} onChange={e => setMesFilter(e.target.value)}>
                  <option value="">Todos los meses</option>
                  {MONTHS_ES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Año</label>
                <select className="form-select" value={anioFilter} onChange={e => setAnioFilter(e.target.value)}>
                  <option value="">Todos los años</option>
                  {anios.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            </div>

            {/* Categoría y Método */}
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Categoría</label>
                <select className="form-select" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
                  <option value="">Todas las categorías</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Método de Pago</label>
                <select className="form-select" value={metodoFilter} onChange={e => setMetodoFilter(e.target.value)}>
                  <option value="">Todos los métodos</option>
                  {metodosPago.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <button className="btn btn-ghost btn-sm" onClick={limpiar}>✕ Limpiar filtros</button>
          </div>

          {/* Vista previa del resultado */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                Vista previa — {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
              </span>
              <div style={{ display: "flex", gap: 16 }}>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Bruto: <strong style={{ color }}>{fmt(totalFiltrado, currency)}</strong></span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>Neto: <strong style={{ color }}>{fmt(netoFiltrado, currency)}</strong></span>
              </div>
            </div>
            <div style={{ maxHeight: 180, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                  Sin registros con los filtros seleccionados
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--bg3)" }}>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "var(--text3)" }}>Fecha</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "var(--text3)" }}>Categoría</th>
                      <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: "var(--text3)" }}>Descripción</th>
                      <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "var(--text3)" }}>Total Neto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, 50).map((r, i) => (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--bg3)" }}>
                        <td style={{ padding: "5px 10px", color: "var(--text2)" }}>{fmtDate(r.fecha)}</td>
                        <td style={{ padding: "5px 10px", color: "var(--text2)" }}>{r.categoria}</td>
                        <td style={{ padding: "5px 10px", color: "var(--text3)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.descripcion}</td>
                        <td style={{ padding: "5px 10px", textAlign: "right", fontWeight: 600, color }}>{fmt(r.totalNeto, currency)}</td>
                      </tr>
                    ))}
                    {filtered.length > 50 && (
                      <tr><td colSpan={4} style={{ padding: "6px 10px", textAlign: "center", color: "var(--text3)", fontSize: 11 }}>... y {filtered.length - 50} registros más</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={filtered.length === 0}
            style={{ opacity: filtered.length === 0 ? 0.5 : 1 }}
          >
            ⬇️ Exportar {filtered.length} registros a CSV
          </button>
        </div>
      </div>
    </div>
  );
}
