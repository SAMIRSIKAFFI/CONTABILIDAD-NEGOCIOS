import { useState } from "react";
import { useApp } from "../context/AppContext";

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export default function Configuracion() {
  const { config, setConfig, isReadOnly } = useApp();
  const [newCat, setNewCat] = useState({ ing: "", gas: "", cos: "", pay: "" });

  const addCat = (type) => {
    const map = {
      ing: { key: "categoriasIngresos", val: newCat.ing },
      gas: { key: "categoriasGastos", val: newCat.gas },
      cos: { key: "categoriasCostos", val: newCat.cos },
      pay: { key: "metodosPago", val: newCat.pay },
    };
    const { key, val } = map[type];
    if (!val.trim()) return;
    setConfig(prev => ({ ...prev, [key]: [...prev[key], val.trim()] }));
    setNewCat(prev => ({ ...prev, [type]: "" }));
  };

  const removeCat = (key, idx) => {
    setConfig(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) }));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">⚙️ Panel de Configuración</h1>
          <p className="page-subtitle">Configura los parámetros base del sistema de contabilidad</p>
        </div>
      </div>

      {isReadOnly && (
        <div style={{ padding: "10px 16px", background: "rgba(249,200,70,0.12)", border: "1px solid rgba(249,200,70,0.3)", borderRadius: 8, marginBottom: 20, color: "#a87c0a", fontSize: 13 }}>
          🔒 Tienes acceso de solo lectura. No puedes modificar la configuración.
        </div>
      )}

      {/* Top settings: period + currency, side by side, visually distinct */}
      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        <SettingCard icon="📅" iconBg="linear-gradient(135deg,#4f8ef7,#3d7adb)" title="Periodo de Inicio" subtitle="Define el primer mes del ejercicio">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Mes de Inicio</label>
              <select className="form-select" value={config.startMonth} disabled={isReadOnly}
                onChange={e => setConfig(prev => ({ ...prev, startMonth: +e.target.value }))}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Año</label>
              <input className="form-input" type="number" value={config.startYear} disabled={isReadOnly}
                onChange={e => setConfig(prev => ({ ...prev, startYear: +e.target.value }))} />
            </div>
          </div>
        </SettingCard>

        <SettingCard icon="💎" iconBg="linear-gradient(135deg,#2dd4a0,#1db882)" title="Moneda y Metas" subtitle="Configura tu divisa y objetivo anual">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Símbolo de Moneda</label>
              <input className="form-input" value={config.currency} disabled={isReadOnly}
                onChange={e => setConfig(prev => ({ ...prev, currency: e.target.value }))} maxLength={4} />
            </div>
            <div className="form-group">
              <label className="form-label">Ganancia Esperada Anual</label>
              <input className="form-input" type="number" value={config.annualGoal} disabled={isReadOnly}
                onChange={e => setConfig(prev => ({ ...prev, annualGoal: +e.target.value }))} />
            </div>
          </div>
        </SettingCard>
      </div>

      {/* Categories section title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, marginTop: 8 }}>
        <div style={{ height: 1, flex: "0 0 24px", background: "var(--border)" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "1px", whiteSpace: "nowrap" }}>
          Categorías y Métodos de Clasificación
        </span>
        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <CatSection
          icon="💰" accent="green" title="Categorías de Ingresos"
          items={config.categoriasIngresos} disabled={isReadOnly}
          value={newCat.ing} onChange={v => setNewCat(p => ({...p, ing: v}))}
          onAdd={() => addCat("ing")} onRemove={i => removeCat("categoriasIngresos", i)} />

        <CatSection
          icon="💸" accent="red" title="Categorías de Gastos"
          items={config.categoriasGastos} disabled={isReadOnly}
          value={newCat.gas} onChange={v => setNewCat(p => ({...p, gas: v}))}
          onAdd={() => addCat("gas")} onRemove={i => removeCat("categoriasGastos", i)} />

        <CatSection
          icon="🏭" accent="yellow" title="Categorías de Costos"
          items={config.categoriasCostos} disabled={isReadOnly}
          value={newCat.cos} onChange={v => setNewCat(p => ({...p, cos: v}))}
          onAdd={() => addCat("cos")} onRemove={i => removeCat("categoriasCostos", i)} />

        <CatSection
          icon="💳" accent="blue" title="Métodos de Pago"
          items={config.metodosPago} disabled={isReadOnly}
          value={newCat.pay} onChange={v => setNewCat(p => ({...p, pay: v}))}
          onAdd={() => addCat("pay")} onRemove={i => removeCat("metodosPago", i)} />
      </div>
    </div>
  );
}

function SettingCard({ icon, iconBg, title, subtitle, children }) {
  return (
    <div className="card" style={{ padding: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 10, background: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 19, flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
        }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

const ACCENT_MAP = {
  green:  { bg: "rgba(45,212,160,0.12)",  border: "rgba(45,212,160,0.35)",  text: "#0d9e72", iconBg: "linear-gradient(135deg,#2dd4a0,#1db882)" },
  red:    { bg: "rgba(247,86,106,0.10)",  border: "rgba(247,86,106,0.3)",   text: "#d63348", iconBg: "linear-gradient(135deg,#f7566a,#e0394f)" },
  yellow: { bg: "rgba(249,200,70,0.14)",  border: "rgba(249,200,70,0.35)",  text: "#a87c0a", iconBg: "linear-gradient(135deg,#f9c846,#e8a830)" },
  blue:   { bg: "rgba(79,142,247,0.10)",  border: "rgba(79,142,247,0.3)",   text: "#3a7af0", iconBg: "linear-gradient(135deg,#4f8ef7,#3d7adb)" },
};

function CatSection({ icon, accent, title, items, value, onChange, onAdd, onRemove, disabled }) {
  const a = ACCENT_MAP[accent];
  return (
    <div className="card" style={{ padding: 22, borderTop: `3px solid ${a.text}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: a.iconBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, flexShrink: 0, boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
          }}>{icon}</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)" }}>{title}</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
          background: a.bg, color: a.text, border: `1px solid ${a.border}`,
        }}>
          {items.length} {items.length === 1 ? "categoría" : "categorías"}
        </span>
      </div>

      <div style={{
        minHeight: 70, padding: items.length ? "12px 4px" : 0,
        background: items.length ? "var(--bg3)" : "transparent",
        borderRadius: 10, marginBottom: 14,
      }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "18px 0", color: "var(--text3)", fontSize: 13 }}>
            Sin categorías aún
          </div>
        ) : (
          <div className="tag-list" style={{ margin: 0, padding: "0 8px" }}>
            {items.map((item, i) => (
              <span key={i} className="tag" style={{
                background: a.bg, borderColor: a.border, color: a.text, fontWeight: 600,
              }}>
                {item}
                {!disabled && (
                  <button className="remove" style={{ color: a.text, opacity: 0.6 }} onClick={() => onRemove(i)}>×</button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {!disabled && (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="form-input" placeholder="Escribe una nueva categoría..." value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAdd()} />
          <button
            className="btn"
            style={{ background: a.text, color: "white", flexShrink: 0 }}
            onClick={onAdd}
          >
            + Agregar
          </button>
        </div>
      )}
    </div>
  );
}
