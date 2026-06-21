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

      <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div className="card-title">Periodo de Inicio</div>
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
        </div>

        <div className="card">
          <div className="card-title">Moneda y Metas</div>
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
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20 }}>
        <CatSection title="Categorías de Ingresos" items={config.categoriasIngresos} disabled={isReadOnly}
          value={newCat.ing} onChange={v => setNewCat(p => ({...p, ing: v}))}
          onAdd={() => addCat("ing")} onRemove={i => removeCat("categoriasIngresos", i)} />
        <CatSection title="Categorías de Gastos" items={config.categoriasGastos} disabled={isReadOnly}
          value={newCat.gas} onChange={v => setNewCat(p => ({...p, gas: v}))}
          onAdd={() => addCat("gas")} onRemove={i => removeCat("categoriasGastos", i)} />
        <CatSection title="Categorías de Costos" items={config.categoriasCostos} disabled={isReadOnly}
          value={newCat.cos} onChange={v => setNewCat(p => ({...p, cos: v}))}
          onAdd={() => addCat("cos")} onRemove={i => removeCat("categoriasCostos", i)} />
        <CatSection title="Métodos de Pago" items={config.metodosPago} disabled={isReadOnly}
          value={newCat.pay} onChange={v => setNewCat(p => ({...p, pay: v}))}
          onAdd={() => addCat("pay")} onRemove={i => removeCat("metodosPago", i)} />
      </div>
    </div>
  );
}

function CatSection({ title, items, value, onChange, onAdd, onRemove, disabled }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="tag-list" style={{ marginBottom: 14 }}>
        {items.map((item, i) => (
          <span key={i} className="tag">
            {item}
            {!disabled && <button className="remove" onClick={() => onRemove(i)}>×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: 8 }}>
          <input className="form-input" placeholder="Nueva categoría..." value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAdd()} />
          <button className="btn btn-primary btn-sm" onClick={onAdd}>+ Agregar</button>
        </div>
      )}
    </div>
  );
}
