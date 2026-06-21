import { useState } from "react";
import { useApp } from "../context/AppContext";
import { fmt, fmtDate } from "../utils/format";
import TransactionModal from "../components/TransactionModal";
import { useSortableData, SortableTh } from "../components/SortableTable";


export default function Gastos() {
  const { config, gastos, addGasto, deleteGasto, updateGasto, isReadOnly, project } = useApp();
  const [modal, setModal] = useState(null);

  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(gastos, "fecha", "desc");

  const fields = [
    { key: "fecha", label: "Fecha", type: "date", required: true },
    { key: "categoria", label: "Categoría", type: "select", options: config.categoriasGastos, required: true },
    { key: "descripcion", label: "Descripción", type: "text" },
    { key: "metodoPago", label: "Método de Pago", type: "select", options: config.metodosPago },
    { key: "gastoTotal", label: "Gasto Total", type: "number", required: true, step: "0.01", min: "0" },
    { key: "impuesto", label: "Impuesto (%)", type: "number", step: "0.01", min: "0" },
    { key: "notas", label: "Notas", type: "textarea" },
  ];

  const totBruto = gastos.reduce((s, x) => s + (x.gastoTotal||0), 0);
  const totImp = gastos.reduce((s, x) => s + (x.valorImpuesto||0), 0);
  const totNeto = gastos.reduce((s, x) => s + (x.totalNeto||0), 0);

  const handleSave = (form) => {
    if (modal.mode === "edit") updateGasto(modal.data.id, form);
    else addGasto(form);
    setModal(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Panel de Gastos</h1>
          <p className="page-subtitle">
            Proyecto: <strong style={{ color: "var(--accent)" }}>{project?.icon} {project?.name}</strong> — Registra y controla todos los gastos
          </p>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-pill"><div className="label">Gastos Brutos</div><div className="value red">{fmt(totBruto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Monto de Impuestos</div><div className="value">{fmt(totImp, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Gastos Netos</div><div className="value red">{fmt(totNeto, config.currency)}</div></div>
        <div className="stat-pill"><div className="label">Registros</div><div className="value">{gastos.length}</div></div>
      </div>

      {!isReadOnly && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
          <button className="btn" style={{ background: "rgba(247,86,106,0.15)", border: "1px solid rgba(247,86,106,0.4)", color: "var(--accent-red)" }}
            onClick={() => setModal({ mode: "add", data: { fecha: new Date().toISOString().split("T")[0], impuesto: 0 } })}>
            + Nuevo Gasto
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Categoría" sortKey="categoria" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th>Descripción</th>
              <th>Método Pago</th>
              <SortableTh label="Gasto Total" sortKey="gastoTotal" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Impuesto %" sortKey="impuesto" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th>Valor Imp.</th>
              <SortableTh label="Total Neto" sortKey="totalNeto" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <th>Notas</th>
              {!isReadOnly && <th>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={11}><div className="empty-state"><div className="icon">💸</div><p>No hay gastos registrados</p></div></td></tr>
            ) : sorted.map((item, i) => (
              <tr key={item.id}>
                <td><span className="badge badge-red">#{i + 1}</span></td>
                <td>{fmtDate(item.fecha)}</td>
                <td><span className="badge badge-red">{item.categoria}</span></td>
                <td>{item.descripcion}</td>
                <td>{item.metodoPago}</td>
                <td className="num-neutral">{fmt(item.gastoTotal, config.currency)}</td>
                <td>{item.impuesto || 0}%</td>
                <td>{fmt(item.valorImpuesto, config.currency)}</td>
                <td className="num-negative">{fmt(item.totalNeto, config.currency)}</td>
                <td>{item.notas}</td>
                {!isReadOnly && (
                  <td>
                    <div className="td-actions">
                      <button className="btn btn-ghost btn-sm" onClick={() => setModal({ mode: "edit", data: item })}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={() => confirm("¿Eliminar gasto?") && deleteGasto(item.id)}>🗑️</button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <TransactionModal title={modal.mode === "edit" ? "Editar Gasto" : "Nuevo Gasto"} fields={fields} initial={modal.data} onSave={handleSave} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
