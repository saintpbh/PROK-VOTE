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
     * Load KoPub Dotum Bold web font via @font-face for Canvas rendering
     */
    private async loadKoPubFont(): Promise<void> {
        if (this.fontLoaded) return;

        try {
            // Inject @font-face if not already present
            if (!document.getElementById('kopub-font-style')) {
                const style = document.createElement('style');
                style.id = 'kopub-font-style';
                style.textContent = `
                    @font-face {
                        font-family: 'KoPub Dotum';
                        font-weight: 700;
                        font-style: normal;
                        src: url('https://cdn.jsdelivr.net/npm/font-kopub@1.0/fonts/KoPubDotum-Bold.woff') format('woff'),
                             url('https://cdn.jsdelivr.net/npm/font-kopub@1.0/fonts/KoPubDotum-Bold.ttf') format('truetype');
                    }
                    @font-face {
                        font-family: 'KoPub Dotum';
                        font-weight: 400;
                        font-style: normal;
                        src: url('https://cdn.jsdelivr.net/npm/font-kopub@1.0/fonts/KoPubDotum-Medium.woff') format('woff'),
                             url('https://cdn.jsdelivr.net/npm/font-kopub@1.0/fonts/KoPubDotum-Medium.ttf') format('truetype');
                    }
                `;
                document.head.appendChild(style);
            }

            // Force browser to load the font by rendering an invisible element
            const preload = document.createElement('span');
            preload.style.fontFamily = "'KoPub Dotum'";
            preload.style.fontWeight = '700';
            preload.style.position = 'absolute';
            preload.style.left = '-9999px';
            preload.style.fontSize = '1px';
            preload.textContent = '가나다라';
            document.body.appendChild(preload);

            // Wait for font to be ready
            await document.fonts.ready;
            document.body.removeChild(preload);

            this.fontLoaded = true;
        } catch (error) {
            console.warn('KoPub font load failed, using fallback:', error);
        }
    }

    /**
     * Render text to a canvas image (supports Korean/CJK natively via browser fonts).
     * Returns a data URL that can be embedded in the PDF.
     */
    private renderTextImage(
        text: string,
        options: {
            fontSize: number;
            fontWeight?: string;
            color?: string;
            bgColor?: string;
            maxWidth: number;
            height: number;
            align?: 'center' | 'left' | 'right';
            fontFamily?: string;
            extraBold?: boolean; // Use strokeText for extra thickness
        }
    ): string {
        const scale = 4; // Higher res for KoPub crisp rendering
        const canvas = document.createElement('canvas');
        canvas.width = options.maxWidth * scale;
        canvas.height = options.height * scale;
        const ctx = canvas.getContext('2d')!;

        // Background
        if (options.bgColor) {
            ctx.fillStyle = options.bgColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Text
        const weight = options.fontWeight || 'normal';
        const family = options.fontFamily || "'KoPub Dotum', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif";
        ctx.font = `${weight} ${options.fontSize * scale}px ${family}`;
        ctx.fillStyle = options.color || '#000000';
        ctx.textAlign = options.align || 'center';
        ctx.textBaseline = 'middle';

        const xPos = options.align === 'left' ? 10 : options.align === 'right' ? canvas.width - 10 : canvas.width / 2;

        // Extra bold: draw stroke + fill for thick text
        if (options.extraBold) {
            ctx.strokeStyle = options.color || '#000000';
            ctx.lineWidth = scale * 1.2;
            ctx.lineJoin = 'round';
            ctx.strokeText(text, xPos, canvas.height / 2, canvas.width - 20);
        }

        ctx.fillText(text, xPos, canvas.height / 2, canvas.width - 20);

        return canvas.toDataURL('image/png');
    }

    /**
     * Generate PDF with QR codes designed as cuttable voting tickets.
     * Each ticket includes session name, QR code, and ticket number.
     * Korean text is rendered via Canvas to avoid jsPDF font compatibility issues.
     */
    async generatePDF(tokens: string[], baseUrl: string, sessionName?: string, titleColor?: { r: number; g: number; b: number }): Promise<void> {
        // Load KoPub Dotum Bold font before rendering
        await this.loadKoPubFont();

        const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

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

        // Pre-render reusable text images (Korean) — KoPub Dotum Bold, extra bold for elderly voters
        const headerTextImg = this.renderTextImage(displayName, {
            fontSize: 22,
            fontWeight: '700',
            color: '#FFFFFF',
            maxWidth: 400,
            height: 36,
            align: 'center',
            extraBold: true, // stroke + fill for maximum thickness
        });

        const subtitleImg = this.renderTextImage('해당 세션에만 투표가 가능합니다', {
            fontSize: 13,
            fontWeight: 'bold',
            color: '#FFFFFF',
            maxWidth: 400,
            height: 22,
            align: 'center',
        });

        const instructionImg = this.renderTextImage('스마트폰 카메라로 QR코드를 스캔해 주세요', {
            fontSize: 12,
            fontWeight: 'bold',
            color: '#555566',
            maxWidth: 400,
            height: 20,
            align: 'center',
        });

        for (let page = 0; page < totalPages; page++) {
            if (page > 0) {
                pdf.addPage();
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

                // Inner card
                const innerPad = 2;
                const innerX = x + innerPad;
                const innerY = y + innerPad;
                const innerW = cellWidth - 2 * innerPad;
                const innerH = cellHeight - 2 * innerPad;

                // Inner card background
                pdf.setFillColor(250, 250, 252);
                pdf.setDrawColor(220, 220, 225);
                pdf.setLineWidth(0.2);
                pdf.roundedRect(innerX, innerY, innerW, innerH, 2, 2, 'FD');

                // ---- Header bar (colored, taller for readability) ----
                const headerH = 16;
                const hc = titleColor || { r: 30, g: 30, b: 45 };
                pdf.setFillColor(hc.r, hc.g, hc.b);
                pdf.roundedRect(innerX, innerY, innerW, headerH + 2, 2, 2, 'F');
                pdf.rect(innerX, innerY + 2, innerW, headerH, 'F');

                // Session name (as canvas image) — large & bold
                const headerImgW = innerW - 2;
                const headerImgH = 6;
                pdf.addImage(headerTextImg, 'PNG', innerX + 1, innerY + 1.5, headerImgW, headerImgH);

                // Subtitle (as canvas image) — bold white
                const subtitleImgH = 4;
                pdf.addImage(subtitleImg, 'PNG', innerX + 1, innerY + 8, headerImgW, subtitleImgH);

                // ---- QR Code ----
                const qrDataUrl = await QRCode.toDataURL(pageCodes[i].url, {
                    width: 400,
                    margin: 1,
                    color: { dark: '#1a1a2e', light: '#FFFFFF' },
                    errorCorrectionLevel: 'M',
                });

                const qrX = innerX + (innerW - qrSize) / 2;
                const qrY = innerY + headerH + 3;

                // QR white background
                pdf.setFillColor(255, 255, 255);
                pdf.setDrawColor(235, 235, 240);
                pdf.setLineWidth(0.15);
                const qrPad = 1.5;
                pdf.roundedRect(qrX - qrPad, qrY - qrPad, qrSize + 2 * qrPad, qrSize + 2 * qrPad, 1, 1, 'FD');
                pdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

                // ---- Footer ----
                const footerY = qrY + qrSize + 2;

                // Ticket number (ASCII only — safe with helvetica)
                const ticketNum = startIdx + i + 1;
                pdf.setTextColor(80, 80, 100);
                pdf.setFontSize(7);
                pdf.setFont('helvetica', 'bold');
                pdf.text(`No. ${String(ticketNum).padStart(3, '0')}`, innerX + innerW / 2, footerY + 2, { align: 'center' });

                // Instruction (Korean, as canvas image) — bold for readability
                const instrImgH = 4;
                pdf.addImage(instructionImg, 'PNG', innerX + 1, footerY + 3.5, headerImgW, instrImgH);

                // Decorative line
                pdf.setDrawColor(220, 220, 230);
                pdf.setLineWidth(0.15);
                const lineY = footerY + 7.5;
                pdf.line(innerX + 8, lineY, innerX + innerW - 8, lineY);

                // Token ID (ASCII only — safe with courier)
                pdf.setFontSize(4);
                pdf.setTextColor(170, 170, 185);
                pdf.setFont('courier', 'normal');
                pdf.text(pageCodes[i].tokenId.substring(0, 12), innerX + innerW / 2, lineY + 2.5, { align: 'center' });

                // Scissors icon
                pdf.setFontSize(6);
                pdf.setTextColor(200, 200, 210);
                pdf.setFont('helvetica', 'normal');
                pdf.text('- -', x + 0.5, y + 3);
            }
        }

        // Download
        const timestamp = new Date().toISOString().split('T')[0];
        const safeName = (sessionName || 'prok-vote').replace(/[^a-zA-Z0-9\uAC00-\uD7A3]/g, '-');
        const filename = `${safeName}-QR-${timestamp}.pdf`;
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
     * Preview single QR code
     */
    async generateSingleQR(url: string): Promise<string> {
        return await QRCode.toDataURL(url, {
            width: 400,
            margin: 1,
            color: { dark: '#1a1a2e', light: '#FFFFFF' },
            errorCorrectionLevel: 'M',
        });
    }
}

const qrPDFGenerator = new QRPDFGenerator();
export default qrPDFGenerator;
