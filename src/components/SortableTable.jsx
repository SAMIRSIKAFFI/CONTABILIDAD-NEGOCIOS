import { useState, useMemo } from "react";

// ─── useSortableData ───────────────────────────────────────────
export function useSortableData(items, defaultKey = "fecha", defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === "fecha") { av = av || ""; bv = bv || ""; }
      else if (typeof av === "string" || typeof bv === "string") {
        av = (av ?? "").toString().toLowerCase();
        bv = (bv ?? "").toString().toLowerCase();
      } else { av = av ?? 0; bv = bv ?? 0; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}

// ─── usePagination ─────────────────────────────────────────────
export function usePagination(items, pageSize = 25) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const goTo = (p) => setPage(Math.max(1, Math.min(p, totalPages)));
  useMemo(() => { if (safePage !== page) setPage(safePage); }, [totalPages]);
  return { pageItems, page: safePage, totalPages, goTo, start, total: items.length };
}

// ─── Pagination UI ─────────────────────────────────────────────
export function Pagination({ page, totalPages, goTo, total, pageSize, start }) {
  if (totalPages <= 1) return null;
  const end = Math.min(start + pageSize, total);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, padding: "8px 4px", fontSize: 12, color: "var(--text3)" }}>
      <span>Mostrando {start + 1}–{end} de {total} registros</span>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <PagBtn onClick={() => goTo(1)} disabled={page === 1}>«</PagBtn>
        <PagBtn onClick={() => goTo(page - 1)} disabled={page === 1}>‹</PagBtn>
        {buildPageNumbers(page, totalPages).map((p, i) =>
          p === "…" ? <span key={"d" + i} style={{ padding: "0 4px" }}>…</span>
            : <PagBtn key={p} active={p === page} onClick={() => goTo(p)}>{p}</PagBtn>
        )}
        <PagBtn onClick={() => goTo(page + 1)} disabled={page === totalPages}>›</PagBtn>
        <PagBtn onClick={() => goTo(totalPages)} disabled={page === totalPages}>»</PagBtn>
      </div>
    </div>
  );
}

function PagBtn({ children, onClick, disabled, active }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      minWidth: 28, height: 28, padding: "0 6px", borderRadius: 6, fontSize: 12,
      border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
      background: active ? "var(--accent)" : "var(--bg3)",
      color: active ? "#fff" : disabled ? "var(--text3)" : "var(--text)",
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1,
    }}>{children}</button>
  );
}

function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [...Array.from({ length: 5 }, (_, i) => i + 1), "…", total];
  if (current >= total - 3) return [1, "…", ...Array.from({ length: 5 }, (_, i) => total - 4 + i)];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ─── useTableSearch ────────────────────────────────────────────
export function useTableSearch(items, searchKeys = ["descripcion", "categoria", "notas"]) {
  const [search,    setSearch]    = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterMes, setFilterMes] = useState("");   // "YYYY-MM"
  const [filterAno, setFilterAno] = useState("");   // "YYYY"

  const filtered = useMemo(() => {
    let res = items;
    if (filterCat) res = res.filter(x => x.categoria === filterCat);
    if (filterAno) res = res.filter(x => String(x.year) === filterAno);
    if (filterMes) {
      const [y, m] = filterMes.split("-").map(Number);
      res = res.filter(x => x.month === m && x.year === y);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      res = res.filter(x => searchKeys.some(k => (x[k] ?? "").toString().toLowerCase().includes(q)));
    }
    return res;
  }, [items, search, filterCat, filterMes, filterAno]);

  const limpiar = () => { setSearch(""); setFilterCat(""); setFilterMes(""); setFilterAno(""); };
  const hayFiltro = search || filterCat || filterMes || filterAno;

  return { filtered, search, setSearch, filterCat, setFilterCat, filterMes, setFilterMes, filterAno, setFilterAno, limpiar, hayFiltro };
}

// ─── TableSearchBar ────────────────────────────────────────────
export function TableSearchBar({ search, onSearch, filterCat, onFilterCat, filterMes, onFilterMes, filterAno, onFilterAno, categories, placeholder = "Buscar...", limpiar, hayFiltro }) {
  // Años disponibles en los datos (hardcoded range)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  return (
    <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap", alignItems: "center" }}>
      {/* Buscador texto */}
      <div style={{ position: "relative", flex: "1 1 180px", minWidth: 150 }}>
        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", fontSize: 14, pointerEvents: "none" }}>🔍</span>
        <input className="form-input" style={{ paddingLeft: 32, margin: 0 }} value={search} onChange={e => onSearch(e.target.value)} placeholder={placeholder} />
      </div>

      {/* Filtro mes */}
      {onFilterMes && (
        <select className="form-select" style={{ flex: "0 0 auto", minWidth: 130, margin: 0 }}
          value={filterMes} onChange={e => { onFilterMes(e.target.value); if (e.target.value && onFilterAno) onFilterAno(""); }}>
          <option value="">Todos los meses</option>
          {years.flatMap(y => MONTHS_ES.map((m, i) => (
            <option key={`${y}-${i+1}`} value={`${y}-${String(i+1).padStart(2,"0")}`}>{m} {y}</option>
          )))}
        </select>
      )}

      {/* Filtro año */}
      {onFilterAno && !filterMes && (
        <select className="form-select" style={{ flex: "0 0 auto", minWidth: 90, margin: 0 }}
          value={filterAno} onChange={e => onFilterAno(e.target.value)}>
          <option value="">Todos los años</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
      )}

      {/* Filtro categoría */}
      {categories?.length > 0 && (
        <select className="form-select" style={{ flex: "0 0 auto", minWidth: 140, margin: 0 }}
          value={filterCat} onChange={e => onFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}

      {/* Botón limpiar */}
      {hayFiltro && (
        <button className="btn btn-ghost btn-sm" onClick={limpiar} style={{ flexShrink: 0 }}>✕ Limpiar</button>
      )}

      {/* Indicador de filtro activo */}
      {filterMes && (
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(79,142,247,0.15)", color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>
          📅 {MONTHS_ES[parseInt(filterMes.split("-")[1])-1]} {filterMes.split("-")[0]}
        </span>
      )}
      {filterAno && !filterMes && (
        <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 20, background: "rgba(79,142,247,0.15)", color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>
          📅 Año {filterAno}
        </span>
      )}
    </div>
  );
}

// ─── SortableTh ────────────────────────────────────────────────
export function SortableTh({ label, sortKey: key, currentKey, currentDir, onSort, style, align }) {
  const active = currentKey === key;
  const isRight = align === "right";
  return (
    <th onClick={() => onSort(key)} style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", textAlign: isRight ? "right" : undefined, ...style }} title="Click para ordenar">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: isRight ? "flex-end" : "flex-start", width: "100%" }}>
        {isRight && <span style={{ fontSize: 10, opacity: active ? 1 : 0.25, color: active ? "var(--accent)" : "inherit" }}>{active ? (currentDir === "asc" ? "▲" : "▼") : "▲▼"}</span>}
        {label}
        {!isRight && <span style={{ fontSize: 10, opacity: active ? 1 : 0.25, color: active ? "var(--accent)" : "inherit" }}>{active ? (currentDir === "asc" ? "▲" : "▼") : "▲▼"}</span>}
      </span>
    </th>
  );
}
