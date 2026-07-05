import { useState, useMemo } from "react";

/**
 * useSortableData - hook that returns sorted data + sort controls
 * @param {Array} items - array of records
 * @param {string} defaultKey - default sort field
 * @param {string} defaultDir - 'asc' | 'desc'
 */
export function useSortableData(items, defaultKey = "fecha", defaultDir = "desc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const sorted = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];

      // Handle dates (string YYYY-MM-DD compares fine lexically)
      if (sortKey === "fecha") {
        av = av || "";
        bv = bv || "";
      } else if (typeof av === "string" || typeof bv === "string") {
        av = (av ?? "").toString().toLowerCase();
        bv = (bv ?? "").toString().toLowerCase();
      } else {
        av = av ?? 0;
        bv = bv ?? 0;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [items, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return { sorted, sortKey, sortDir, toggleSort };
}

/**
 * SortableTh - clickable <th> that shows sort arrow
 */
export function SortableTh({ label, sortKey: key, currentKey, currentDir, onSort, style, align }) {
  const active = currentKey === key;
  const isRight = align === "right";
  return (
    <th
      onClick={() => onSort(key)}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap", textAlign: isRight ? "right" : undefined, ...style }}
      title="Click para ordenar"
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, justifyContent: isRight ? "flex-end" : "flex-start", width: "100%" }}>
        {isRight && (
          <span style={{ fontSize: 10, opacity: active ? 1 : 0.25, color: active ? "var(--accent)" : "inherit" }}>
            {active ? (currentDir === "asc" ? "▲" : "▼") : "▲▼"}
          </span>
        )}
        {label}
        {!isRight && (
          <span style={{ fontSize: 10, opacity: active ? 1 : 0.25, color: active ? "var(--accent)" : "inherit" }}>
            {active ? (currentDir === "asc" ? "▲" : "▼") : "▲▼"}
          </span>
        )}
      </span>
    </th>
  );
}

/**
 * useTableSearch - hook for filtering by search text, category, month, year
 */
export function useTableSearch(items) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [filterAno, setFilterAno] = useState("");

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || [item.categoria, item.descripcion, item.metodoPago, item.notas]
        .some(v => (v || "").toLowerCase().includes(search.toLowerCase()));
      const matchCat = !filterCat || item.categoria === filterCat;
      const matchMes = !filterMes || String(item.month) === String(filterMes);
      const matchAno = !filterAno || String(item.year) === String(filterAno);
      return matchSearch && matchCat && matchMes && matchAno;
    });
  }, [items, search, filterCat, filterMes, filterAno]);

  const hayFiltro = !!(search || filterCat || filterMes || filterAno);
  const limpiar = () => { setSearch(""); setFilterCat(""); setFilterMes(""); setFilterAno(""); };

  return { filtered, search, setSearch, filterCat, setFilterCat, filterMes, setFilterMes, filterAno, setFilterAno, limpiar, hayFiltro };
}

/**
 * TableSearchBar - search and filter controls
 */
export function TableSearchBar({ search, setSearch, filterCat, setFilterCat, categorias = [], limpiar, hayFiltro }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <input
        className="form-input"
        style={{ maxWidth: 260, flex: 1 }}
        placeholder="🔍 Buscar..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {categorias.length > 0 && (
        <select className="form-select" style={{ maxWidth: 200 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {hayFiltro && (
        <button className="btn btn-ghost btn-sm" onClick={limpiar}>✕ Limpiar</button>
      )}
    </div>
  );
}

/**
 * usePagination - hook for paginating an array
 */
export function usePagination(items, pageSize = 25) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const goTo = (p) => setPage(Math.max(1, Math.min(p, totalPages)));
  return { page: safePage, totalPages, pageItems, start, goTo, total: items.length };
}

/**
 * Pagination - pagination controls component
 */
export function Pagination({ page, totalPages, goTo, total, pageSize, start }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--text3)", flexWrap: "wrap", gap: 8 }}>
      <span>Mostrando {start + 1}–{Math.min(start + pageSize, total)} de {total}</span>
      <div style={{ display: "flex", gap: 4 }}>
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => goTo(1)}>«</button>
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => goTo(page - 1)}>‹</button>
        <span style={{ padding: "4px 10px", fontWeight: 600, color: "var(--text)" }}>{page} / {totalPages}</span>
        <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => goTo(page + 1)}>›</button>
        <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => goTo(totalPages)}>»</button>
      </div>
    </div>
  );
}
