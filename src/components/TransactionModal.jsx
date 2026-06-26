import { useState, useEffect } from "react";

export default function TransactionModal({ title, fields, onSave, onClose, initial = {} }) {
  const [form, setForm] = useState(initial);
  useEffect(() => { setForm(initial); }, [JSON.stringify(initial)]);
  const handleChange = (key, val) => setForm(prev => ({ ...prev, [key]: val }));
  const handleSubmit = () => {
    for (const f of fields) {
      if (f.required && !form[f.key] && form[f.key] !== 0) { alert(`El campo "${f.label}" es requerido.`); return; }
    }
    onSave(form);
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {fields.map(f => (
              <div className="form-group" key={f.key}>
                <label className="form-label">{f.label}{f.required ? " *" : ""}</label>
                {f.type === "select" ? (
                  <select className="form-select" value={form[f.key] ?? ""} onChange={e => handleChange(f.key, e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea className="form-textarea" rows={3} value={form[f.key] ?? ""} onChange={e => handleChange(f.key, e.target.value)} placeholder={f.placeholder} />
                ) : (
                  <input className="form-input" type={f.type || "text"} value={form[f.key] ?? (f.type === "number" ? 0 : "")}
                    step={f.step} min={f.min}
                    onChange={e => handleChange(f.key, f.type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
                    placeholder={f.placeholder} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSubmit}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
