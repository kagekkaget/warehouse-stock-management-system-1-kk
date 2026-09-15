import { csvEscape, reportCellText } from "@/lib/format";
import type { ReportData } from "@/lib/reports";

export function reportToCsv(report: ReportData): string {
  const lines: string[] = [];
  lines.push(`"${report.title}"`);
  lines.push(`"Periode";"${report.period}"`);
  lines.push(`"Dihasilkan";"${new Date().toISOString()}"`);
  lines.push("");
  lines.push("Ringkasan");
  lines.push("Indikator;Nilai");
  for (const item of report.summary) {
    lines.push(`${csvEscape(item.label)};${csvEscape(item.value)}`);
  }
  lines.push("");
  lines.push(report.columns.map((c) => csvEscape(c.label)).join(";"));
  for (const row of report.rows) {
    lines.push(report.columns.map((c) => csvEscape(row[c.key] ?? "")).join(";"));
  }
  lines.push("");
  // Use tab-delimited fallback safe for Excel ID locale (semicolon is standard in Indonesia)
  return `\uFEFF${lines.join("\r\n")}`;
}



export async function reportToPdf(report: ReportData, meta: { user: string }): Promise<Uint8Array> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableModule.default ?? autoTableModule) as unknown as (
    doc: unknown,
    options: Record<string, unknown>,
  ) => void;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Sistem Laporan Stok Gudang", 40, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(report.title, 40, 46);
  doc.text(`Periode: ${report.period}`, pageWidth - 40, 28, { align: "right" });
  doc.text(`Dicetak oleh: ${meta.user}`, pageWidth - 40, 46, { align: "right" });

  doc.setTextColor(30, 41, 59);
  let cursorY = 88;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Ringkasan", 40, cursorY);
  cursorY += 8;

  const summaryRows = report.summary.map((item) => [
    item.label,
    reportCellText(item.value, item.type),
  ]);

  autoTable(doc, {
    startY: cursorY,
    head: [["Indikator", "Nilai"]],
    body: summaryRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right" } },
    margin: { left: 40, right: 40 },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  const detailY = (lastTable?.finalY ?? cursorY) + 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Rincian", 40, detailY - 8);

  const body = report.rows.slice(0, 400).map((row) => report.columns.map((c) => reportCellText(row[c.key], c.type)));
  const currencyCols = report.columns
    .map((c, index) => (c.type === "currency" || c.type === "number" ? index : -1))
    .filter((i) => i >= 0);

  autoTable(doc, {
    startY: detailY,
    head: [report.columns.map((c) => c.label)],
    body: body.length ? body : [report.columns.map(() => "-")],
    theme: "striped",
    styles: { fontSize: 8, cellPadding: 3.5, overflow: "linebreak" },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 40, right: 40, top: 60 },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Dicetak ${new Date().toLocaleString("id-ID")} — dokumen internal, patuhi UU PDP No. 27/2022`,
        40,
        doc.internal.pageSize.getHeight() - 20,
      );
      doc.text(`Halaman ${pageCount}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 20, { align: "right" });
    },
    columnStyles: currencyCols.reduce<Record<number, { halign: "right" }>>((acc, idx) => {
      acc[idx] = { halign: "right" };
      return acc;
    }, {}),
  });

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
