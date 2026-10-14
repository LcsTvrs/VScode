import { NextResponse } from "next/server";

export type CsvValue = string | number | Date | null | undefined;

function csvCell(value: CsvValue) {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[\t\r\n ]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvDownload(rows: CsvValue[][], filename: string) {
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
