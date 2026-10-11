import { PDFDocument } from "pdf-lib";

// 複数のPDFを、渡した順に1つのPDFにまとめる(例: 請求書 → 請求内訳書)。
export async function mergePdfs(buffers: Uint8Array[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}
