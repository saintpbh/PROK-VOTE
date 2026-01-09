import jsPDF from 'jspdf';
import QRCode from 'qrcode';

interface QRCodeData {
    tokenId: string;
    url: string;
}

class QRPDFGenerator {
    private readonly PAGE_WIDTH = 210; // A4 width in mm
    private readonly PAGE_HEIGHT = 297; // A4 height in mm
    private readonly MARGIN = 10;
    private readonly CODES_PER_ROW = 4;
    private readonly CODES_PER_COL = 5;
    private readonly CODES_PER_PAGE = 20;

    /**
     * Generate PDF with QR codes
     * @param tokens Array of token IDs
     * @param baseUrl Base URL for QR codes (e.g., https://vote.example.com)
     * @returns Promise that resolves when PDF is generated
     */
    async generatePDF(tokens: string[], baseUrl: string): Promise<void> {
        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const qrCodes: QRCodeData[] = tokens.map((tokenId) => ({
            tokenId,
            url: `${baseUrl}/vote/${tokenId}`,
        }));

        // Calculate cell dimensions
        const usableWidth = this.PAGE_WIDTH - 2 * this.MARGIN;
        const usableHeight = this.PAGE_HEIGHT - 2 * this.MARGIN;
        const cellWidth = usableWidth / this.CODES_PER_ROW;
        const cellHeight = usableHeight / this.CODES_PER_COL;
        const qrSize = Math.min(cellWidth, cellHeight) * 0.7; // 70% of cell size

        // Process codes in batches of 20
        for (let page = 0; page < Math.ceil(qrCodes.length / this.CODES_PER_PAGE); page++) {
            if (page > 0) {
                pdf.addPage();
            }

            const startIdx = page * this.CODES_PER_PAGE;
            const endIdx = Math.min(startIdx + this.CODES_PER_PAGE, qrCodes.length);
            const pageCodes = qrCodes.slice(startIdx, endIdx);

            // Add title
            pdf.setFontSize(16);
            pdf.setFont('helvetica', 'bold');
            pdf.text('PROK Vote - QR Codes', this.PAGE_WIDTH / 2, 6, { align: 'center' });
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text(
                `Page ${page + 1} of ${Math.ceil(qrCodes.length / this.CODES_PER_PAGE)}`,
                this.PAGE_WIDTH / 2,
                11,
                { align: 'center' }
            );

            // Draw grid
            for (let i = 0; i < pageCodes.length; i++) {
                const row = Math.floor(i / this.CODES_PER_ROW);
                const col = i % this.CODES_PER_ROW;

                const x = this.MARGIN + col * cellWidth;
                const y = this.MARGIN + row * cellHeight + 5; // +5 for title offset

                // Draw dotted border
                (pdf as any).setLineDash([2, 2]);
                pdf.setDrawColor(200, 200, 200);
                pdf.rect(x, y, cellWidth, cellHeight);
                (pdf as any).setLineDash([]); // Reset to solid line

                // Generate and add QR code
                const qrDataUrl = await QRCode.toDataURL(pageCodes[i].url, {
                    width: 300,
                    margin: 1,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF',
                    },
                });

                const qrX = x + (cellWidth - qrSize) / 2;
                const qrY = y + 5;
                pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

                // Add token ID below QR code
                pdf.setFontSize(7);
                pdf.setFont('courier', 'normal');
                const tokenText = pageCodes[i].tokenId.substring(0, 8) + '...';
                pdf.text(tokenText, x + cellWidth / 2, y + cellHeight - 3, {
                    align: 'center',
                });

                // Add scissors icon (✂) for cutting guide
                pdf.setFontSize(10);
                pdf.text('✂', x - 2, y + cellHeight / 2);
            }
        }

        // Save PDF
        const timestamp = new Date().toISOString().split('T')[0];
        pdf.save(`prok-vote-qr-codes-${timestamp}.pdf`);
    }

    /**
     * Preview single QR code
     * @param url URL to encode
     * @returns Promise with data URL
     */
    async generateSingleQR(url: string): Promise<string> {
        return await QRCode.toDataURL(url, {
            width: 300,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF',
            },
        });
    }
}

const qrPDFGenerator = new QRPDFGenerator();
export default qrPDFGenerator;
