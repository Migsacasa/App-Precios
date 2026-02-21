"use client";

import {
  createColumnHelper,
  flexRender,
  getFilteredRowModel,
  getCoreRowModel,
  getSortedRowModel,
  type ColumnFiltersState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";

type StoreRow = {
  id: string;
  competitor: string;
  chain: string;
  name: string;
  city: string;
  coords: string;
};

const columnHelper = createColumnHelper<StoreRow>();

export function StoresTable({ data }: { data: StoreRow[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const columns = useMemo(
    () => [
      columnHelper.accessor("competitor", { header: "Customer Code" }),
      columnHelper.accessor("name", { header: "Customer Name" }),
      columnHelper.accessor("city", { header: "City" }),
      columnHelper.accessor("chain", { header: "Last Rating" }),
      columnHelper.accessor("coords", { header: "Coords" }),
    ],
    []
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const cities = Array.from(new Set(data.map((row) => row.city))).filter(Boolean).sort();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          className="border rounded px-3 py-2"
          placeholder="Search customer code, name, city"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
        />
        <select
          className="border rounded px-3 py-2"
          value={(table.getColumn("city")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("city")?.setFilterValue(event.target.value || undefined)}
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto border rounded">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="text-left p-2 cursor-pointer select-none"
                  aria-sort={header.column.getIsSorted() === "asc" ? "ascending" : header.column.getIsSorted() === "desc" ? "descending" : "none"}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                  {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {!table.getRowModel().rows.length && (
            <tr>
              <td className="p-4 text-muted-foreground" colSpan={5}>
                {data.length ? "No stores match the current filters." : "No stores found."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
