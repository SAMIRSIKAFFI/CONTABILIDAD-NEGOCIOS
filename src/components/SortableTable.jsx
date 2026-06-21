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
