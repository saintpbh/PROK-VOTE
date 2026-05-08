import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface QRCodeData {
    tokenId: string;
    url: string;
}

class QRPDFGenerator {
    private readonly PAGE_WIDTH = 210; // A4 width in mm
    private readonly PAGE_HEIGHT = 297; // A4 height in mm
    private readonly MARGIN = 8;
    private readonly CODES_PER_ROW = 3;
    private readonly CODES_PER_COL = 4;
    private readonly CODES_PER_PAGE = 12;
    private fontLoaded = false;

    /**
     * Load Korean font (NanumGothic) into jsPDF
     */
    private async loadKoreanFont(pdf: jsPDF): Promise<void> {
        if (this.fontLoaded) return;

        try {
            // Load regular font
            const regularResponse = await fetch('/fonts/NanumGothic-Regular.ttf');
            const regularBuffer = await regularResponse.arrayBuffer();
            const regularBase64 = this.arrayBufferToBase64(regularBuffer);
            pdf.addFileToVFS('NanumGothic-Regular.ttf', regularBase64);
            pdf.addFont('NanumGothic-Regular.ttf', 'NanumGothic', 'normal');

            // Load bold font
            const boldResponse = await fetch('/fonts/NanumGothic-Bold.ttf');
            const boldBuffer = await boldResponse.arrayBuffer();
            const boldBase64 = this.arrayBufferToBase64(boldBuffer);
            pdf.addFileToVFS('NanumGothic-Bold.ttf', boldBase64);
            pdf.addFont('NanumGothic-Bold.ttf', 'NanumGothic', 'bold');

            this.fontLoaded = true;
        } catch (error) {
            console.error('Failed to load Korean font:', error);
            // Fallback to helvetica
        }
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Set font safely — use Korean font if loaded, fallback to helvetica
     */
    private setFont(pdf: jsPDF, style: 'normal' | 'bold' = 'normal'): void {
        try {
            pdf.setFont('NanumGothic', style);
        } catch {
            pdf.setFont('helvetica', style === 'bold' ? 'bold' : 'normal');
        }
    }

    /**
     * Generate PDF with QR codes designed as cuttable voting tickets.
     * Each ticket includes session name, QR code, and ticket number.
     */
    async generatePDF(tokens: string[], baseUrl: string, sessionName?: string): Promise<void> {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        // Load Korean font
        await this.loadKoreanFont(pdf);

        const qrCodes: QRCodeData[] = tokens.map((tokenId) => ({
            tokenId,
            url: `${baseUrl}/vote/${tokenId}`,
        }));

        const displayName = sessionName || 'PROK VOTE';

        // Calculate cell dimensions
        const usableWidth = this.PAGE_WIDTH - 2 * this.MARGIN;
        const usableHeight = this.PAGE_HEIGHT - 2 * this.MARGIN;
        const cellWidth = usableWidth / this.CODES_PER_ROW;
        const cellHeight = usableHeight / this.CODES_PER_COL;
        const qrSize = Math.min(cellWidth * 0.65, cellHeight * 0.48);

        const totalPages = Math.ceil(qrCodes.length / this.CODES_PER_PAGE);

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
                pdf.addPage();
                // Re-register fonts on new page
                await this.loadKoreanFont(pdf);
            }

            const startIdx = page * this.CODES_PER_PAGE;
            const endIdx = Math.min(startIdx + this.CODES_PER_PAGE, qrCodes.length);
            const pageCodes = qrCodes.slice(startIdx, endIdx);

            for (let i = 0; i < pageCodes.length; i++) {
                const row = Math.floor(i / this.CODES_PER_ROW);
                const col = i % this.CODES_PER_ROW;

                const x = this.MARGIN + col * cellWidth;
                const y = this.MARGIN + row * cellHeight;

                // ---- Draw ticket card ----

                // Dotted cut-line border
                (pdf as any).setLineDash([1.5, 1.5]);
                pdf.setDrawColor(180, 180, 180);
                pdf.setLineWidth(0.3);
                pdf.rect(x, y, cellWidth, cellHeight);
                (pdf as any).setLineDash([]);

                // Inner card area with subtle border
                const innerPad = 2;
                const innerX = x + innerPad;
                const innerY = y + innerPad;
                const innerW = cellWidth - 2 * innerPad;
                const innerH = cellHeight - 2 * innerPad;

                // Inner card background (light gray)
                pdf.setFillColor(250, 250, 252);
                pdf.setDrawColor(220, 220, 225);
                pdf.setLineWidth(0.2);
                pdf.roundedRect(innerX, innerY, innerW, innerH, 2, 2, 'FD');

                // ---- Header bar (dark) ----
                const headerH = 9;
                pdf.setFillColor(30, 30, 45);
                pdf.roundedRect(innerX, innerY, innerW, headerH + 2, 2, 2, 'F');
                pdf.rect(innerX, innerY + 2, innerW, headerH, 'F');

                // Session name in header
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(8);
                this.setFont(pdf, 'bold');
                const titleMaxWidth = innerW - 6;
                const titleText = this.truncateText(pdf, displayName, titleMaxWidth);
                pdf.text(titleText, innerX + innerW / 2, innerY + 5.5, { align: 'center' });

                // Subtitle
                pdf.setFontSize(5.5);
                this.setFont(pdf, 'normal');
                pdf.setTextColor(180, 180, 200);
                pdf.text('해당 세션에만 투표가 가능합니다', innerX + innerW / 2, innerY + 9, { align: 'center' });

                // ---- QR Code ----
                const qrDataUrl = await QRCode.toDataURL(pageCodes[i].url, {
                    width: 400,
                    margin: 1,
                    color: {
                        dark: '#1a1a2e',
                        light: '#FFFFFF',
                    },
                    errorCorrectionLevel: 'M',
                });

                const qrX = innerX + (innerW - qrSize) / 2;
                const qrY = innerY + headerH + 3;

                // QR background white box
                pdf.setFillColor(255, 255, 255);
                pdf.setDrawColor(235, 235, 240);
                pdf.setLineWidth(0.15);
                const qrPadding = 1.5;
                pdf.roundedRect(
                    qrX - qrPadding,
                    qrY - qrPadding,
                    qrSize + 2 * qrPadding,
                    qrSize + 2 * qrPadding,
                    1, 1, 'FD'
                );

                pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

                // ---- Footer area ----
                const footerY = qrY + qrSize + 2;

                // Ticket number
                const ticketNum = startIdx + i + 1;
                pdf.setTextColor(80, 80, 100);
                pdf.setFontSize(6);
                this.setFont(pdf, 'bold');
                pdf.text(
                    `No. ${String(ticketNum).padStart(3, '0')}`,
                    innerX + innerW / 2,
                    footerY + 2,
                    { align: 'center' }
                );

                // Instruction text (Korean)
                pdf.setFontSize(5);
                this.setFont(pdf, 'normal');
                pdf.setTextColor(140, 140, 160);
                pdf.text(
                    '스마트폰 카메라로 QR코드를 스캔해 주세요',
                    innerX + innerW / 2,
                    footerY + 5.5,
                    { align: 'center' }
                );

                // Decorative line
                pdf.setDrawColor(220, 220, 230);
                pdf.setLineWidth(0.15);
                const lineY = footerY + 7;
                pdf.line(innerX + 8, lineY, innerX + innerW - 8, lineY);

                // Token ID (small, for reference)
                pdf.setFontSize(4);
                pdf.setTextColor(170, 170, 185);
                pdf.setFont('courier', 'normal');
                pdf.text(
                    pageCodes[i].tokenId.substring(0, 12),
                    innerX + innerW / 2,
                    lineY + 2.5,
                    { align: 'center' }
                );

                // Scissors icon at corners
                pdf.setFontSize(6);
                pdf.setTextColor(200, 200, 210);
                pdf.text('✂', x + 0.5, y + 3.5);
            }
        }

        // Download
        const timestamp = new Date().toISOString().split('T')[0];
        const safeName = (sessionName || 'prok-vote').replace(/[^a-zA-Z0-9가-힣]/g, '-');
        const filename = `${safeName}-투표권-${timestamp}.pdf`;
        const pdfBlob = pdf.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        }, 500);
    }

    /**
     * Truncate text to fit within max width
     */
    private truncateText(pdf: jsPDF, text: string, maxWidth: number): string {
        let truncated = text;
        while (pdf.getTextWidth(truncated) > maxWidth && truncated.length > 3) {
            truncated = truncated.slice(0, -1);
        }
        if (truncated.length < text.length) {
            truncated = truncated.slice(0, -1) + '…';
        }
        return truncated;
    }

    /**
     * Preview single QR code
     */
    async generateSingleQR(url: string): Promise<string> {
        return await QRCode.toDataURL(url, {
            width: 400,
            margin: 1,
            color: {
                dark: '#1a1a2e',
                light: '#FFFFFF',
            },
            errorCorrectionLevel: 'M',
        });
    }
}

const qrPDFGenerator = new QRPDFGenerator();
export default qrPDFGenerator;
