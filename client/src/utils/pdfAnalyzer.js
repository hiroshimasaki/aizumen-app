import { pdfjs } from 'react-pdf';

/**
 * Extract text from all pages of a PDF file using pdfjs-dist
 * @param {File|Blob} file The PDF file
 * @returns {Promise<Array<{pageNumber: number, text: string}>>} Array of extracted text per page
 */
export async function extractPdfText(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;
        const pageTexts = [];

        for (let i = 1; i <= totalPages; i++) {
            try {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const text = textContent.items.map(item => item.str).join(' ');
                pageTexts.push({ pageNumber: i, text });
            } catch (pageErr) {
                console.error(`Error extracting text from page ${i}:`, pageErr);
                pageTexts.push({ pageNumber: i, text: '' });
            }
        }
        return pageTexts;
    } catch (err) {
        console.error('Error analyzing PDF:', err);
        throw err;
    }
}

/**
 * ヒューリスティックにPDFの中から「注文書」と思われるページを判定する
 * 実際のAI解析の前に、複数ページPDFの一括アップロードエラーを暫定的に回避するためのロジック
 * @param {Array<{pageNumber: number, text: string}>} pageTexts
 * @returns {number|null} 注文書と判定されたページ番号 (1-indexed)、見つからなければ null
 */
export function findPurchaseOrderPage(pageTexts) {
    // 注文書によく含まれるキーワード群
    const poKeywords = ['注文書', '発注書', '注文', '発注', '御見積', '注文番号', '発注番号', 'Purchase Order', 'PO'];

    // スコアリングで最も可能性の高いページを判定
    let bestScore = 0;
    let bestPage = null;

    for (const page of pageTexts) {
        let score = 0;
        const text = page.text.toUpperCase(); // 小文字・大文字のブレを吸収

        for (const kw of poKeywords) {
            const index = text.indexOf(kw.toUpperCase());
            if (index !== -1) {
                score += 1;
                // キーワードがページの先頭の方（タイトルやヘッダ部分）にある場合はスコアをさらに加算
                if (index < 500) {
                    score += 2;
                }
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestPage = page.pageNumber;
        }
    }

    // 最低限の閾値（例えばスコア1以上）を満たせば採用
    return bestScore > 0 ? bestPage : null;
}
