import { PDFDocument } from 'pdf-lib';

/**
 * PDFから特定のページ範囲を抽出し、新しいPDFのBlobとして返す
 * @param {File|Blob} originalFile 元のPDFファイル
 * @param {number[]} pageNumbers 抽出するページ番号の配列 (1-indexed)
 * @returns {Promise<Blob>} 抽出後のPDFのBlob
 */
export async function splitPdf(originalFile, pageNumbers) {
    if (!pageNumbers || pageNumbers.length === 0) return null;

    try {
        const arrayBuffer = await originalFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        const newPdfDoc = await PDFDocument.create();

        // ページ番号を 0-indexed に変換し、存在するページのみ追加
        const indices = pageNumbers
            .map(n => n - 1)
            .filter(i => i >= 0 && i < pdfDoc.getPageCount());

        if (indices.length === 0) return null;

        const copiedPages = await newPdfDoc.copyPages(pdfDoc, indices);
        copiedPages.forEach((page) => newPdfDoc.addPage(page));

        const pdfBytes = await newPdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    } catch (err) {
        console.error('[pdfSplitter] Failed to split PDF:', err);
        throw err;
    }
}
