import { useState } from "react";
import { useApp } from "../context/AppContext";

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const ACCENT = {
  ingreso: { text: "#0d9e72", bg: "rgba(45,212,160,0.10)", border: "rgba(45,212,160,0.3)", icon: "💰" },
  gasto:   { text: "#d63348", bg: "rgba(247,86,106,0.08)", border: "rgba(247,86,106,0.28)", icon: "💸" },
  costo:   { text: "#a87c0a", bg: "rgba(249,200,70,0.12)", border: "rgba(249,200,70,0.3)", icon: "🏭" },
};

const EMPTY_FORM = { categoria: "", descripcion: "", metodoPago: "", impuesto: 0, expectedDay: 5, notas: "" };

export default function RecurringPanel({ type, categorias, metodosPago, onUseTemplate, isReadOnly }) {
  const { templates, addTemplate, updateTemplate, deleteTemplate, getPendingTemplates } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const a = ACCENT[type];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const myTemplates = templates.filter(t => t.type === type);
  const pending = getPendingTemplates(type, currentMonth, currentYear);

  const openNew = () => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true); };

  const openEdit = (tpl) => {
    setEditingId(tpl.id);
    setForm({ categoria: tpl.categoria || "", descripcion: tpl.descripcion || "", metodoPago: tpl.metodoPago || "", impuesto: tpl.impuesto || 0, expectedDay: tpl.expectedDay || 5, notas: tpl.notas || "" });
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.categoria || !form.descripcion) { alert("Categoría y Descripción son obligatorias."); return; }
    if (editingId) updateTemplate(editingId, { ...form, type });
    else addTemplate({ ...form, type });
    setForm(EMPTY_FORM); setEditingId(null); setShowForm(false);
  };

  const handleCancel = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };

  if (myTemplates.length === 0 && !showForm) {
    if (isReadOnly) return null;
    return (
      <div className="card" style={{ marginBottom: 20, borderStyle: "dashed", borderColor: a.border, textAlign: "center", padding: 18 }}>
        <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 10 }}>
          {a.icon} ¿Tienes {type === "ingreso" ? "ingresos" : type === "gasto" ? "gastos" : "costos"} que se repiten cada mes? Crea una plantilla y ahorra tiempo.
        </p>
        <button className="btn btn-ghost btn-sm" onClick={openNew}>+ Crear primera plantilla recurrente</button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 14, borderColor: a.border, background: a.bg }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: a.text }}>Pendientes de {MONTHS_ES[currentMonth - 1]} {currentYear} ({pending.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pending.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", border: `1px solid ${a.border}`, borderRadius: 8, padding: "8px 12px" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>{t.categoria}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{t.descripcion} · esperado día {t.expectedDay}</div>
                </div>
                {!isReadOnly && <button className="btn btn-sm" style={{ background: a.text, color: "white", flexShrink: 0 }} onClick={() => onUseTemplate(t)}>Registrar ahora →</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>📌</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>Plantillas Recurrentes</span>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: a.bg, color: a.text, fontWeight: 700 }}>{myTemplates.length}</span>
          </div>
          {!isReadOnly && !showForm && <button className="btn btn-ghost btn-sm" onClick={openNew}>+ Nueva plantilla</button>}
        </div>

        {myTemplates.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: showForm ? 14 : 0 }}>
            {myTemplates.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20, padding: "6px 6px 6px 12px" }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{t.categoria}</span>
                <span style={{ fontSize: 11, color: "var(--text3)" }}>· día {t.expectedDay}</span>
                {!isReadOnly && (
                  <>
                    <button className="btn btn-sm" style={{ background: a.text, color: "white", padding: "3px 10px", fontSize: 11 }} onClick={() => onUseTemplate(t)}>Usar</button>
                    <button className="btn btn-ghost btn-sm" style={{ padding: "3px 8px", fontSize: 11 }} title="Editar" onClick={() => openEdit(t)}>✏️</button>
                    <button onClick={() => confirm("¿Eliminar esta plantilla?") && deleteTemplate(t.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 14, padding: "0 4px" }}>×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {showForm && (
          <div style={{ borderTop: myTemplates.length ? "1px solid var(--border)" : "none", paddingTop: myTemplates.length ? 14 : 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12, color: a.text, marginBottom: 10 }}>{editingId ? "✏️ Editar plantilla" : "➕ Nueva plantilla"}</div>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select className="form-select" value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Método de Pago</label>
                <select className="form-select" value={form.metodoPago} onChange={e => setForm(p => ({ ...p, metodoPago: e.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {metodosPago.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <input className="form-input" value={form.descripcion} placeholder="Ej: Alquiler Oficina" onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Día esperado del mes</label>
                <input className="form-input" type="number" min="1" max="31" value={form.expectedDay} onChange={e => setForm(p => ({ ...p, expectedDay: +e.target.value }))} />
              </div>
            </div>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label">Impuesto % (opcional)</label>
                <input className="form-input" type="number" min="0" max="100" step="0.01" value={form.impuesto} onChange={e => setForm(p => ({ ...p, impuesto: +e.target.value }))} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={handleCancel}>Cancelar</button>
              <button className="btn btn-sm" style={{ background: a.text, color: "white" }} onClick={handleSave}>{editingId ? "Actualizar Plantilla" : "Guardar Plantilla"}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
