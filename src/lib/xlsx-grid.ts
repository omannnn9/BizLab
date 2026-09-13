// Dynamically imported so opening a docx/pdf/image file doesn't pull the
// (fairly large) SheetJS bundle into the same chunk.
async function loadXlsx() {
  return import("@e965/xlsx");
}

/** Reads the first sheet of a .xlsx/.xls workbook into a plain 2D grid
 * of display strings — no formulas, formatting or multi-sheet support,
 * just cell values, which is what a simple editable table needs. Rows
 * are padded to the same width so every row can be indexed uniformly. */
export async function xlsxToGrid(data: ArrayBuffer): Promise<string[][]> {
  const XLSX = await loadXlsx();
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  const width = rows.reduce((max, row) => Math.max(max, row.length), 1);
  return rows.map((row) => {
    const padded = [...row];
    while (padded.length < width) padded.push("");
    return padded.map((cell) => (cell ?? "").toString());
  });
}

/** Writes a 2D grid back out as a real .xlsx workbook Blob. */
export async function gridToXlsxBlob(grid: string[][]): Promise<Blob> {
  const XLSX = await loadXlsx();
  const sheet = XLSX.utils.aoa_to_sheet(grid);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
