import { Pagination, PaginationProps } from "./pagination";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyMessage?: React.ReactNode;
  onRowClick?: (item: T) => void;
  pagination?: PaginationProps;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  isLoading = false,
  emptyMessage = "No records found.",
  onRowClick,
  pagination,
}: TableProps<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-3.5 px-4 font-semibold ${col.headerClassName || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                <div className="inline-flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-2 border-[#0073EA] border-t-transparent animate-spin" />
                  <span>Loading records...</span>
                </div>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors hover:bg-blue-50/30 ${
                  onRowClick ? "cursor-pointer" : ""
                }`}
              >
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className={`py-3.5 px-4 ${col.className || ""}`}>
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? String(item[col.accessorKey] ?? "")
                      : null}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}
