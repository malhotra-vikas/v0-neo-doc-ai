import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer } from 'docx';

const COLORS = {
    PUZZLE_BLUE: '#28317c',
    PAGE_NUMBER: '#11b3dc',
    TITLE: '#2e3771',
    BULLET_TEXT: '#6b789a',
    PATIENT_NAME: '#858387',
    PATIENT_DETAILS: '#bab4bf',
    LIGHT_GRAY: '#e5e7eb',
    CARD1: {
        BACKGROUND: '#e8e0f0',
        TITLE: '#97939a',
        TEXT: '#8a8a8e',
        BORDER: '#5d6a90'
    },
    // Second card theme
    CARD2: {
        BACKGROUND: '#c8e8f2',
        TITLE: '#7d8689',
        TEXT: '#727f84',
        BORDER: '#5d6a90'
    }
};

const BULLET_STYLE = {
    RADIUS: 0.8,
    INDENT: 13,
    TEXT_INDENT: 22,
    LINE_HEIGHT: 7,
    BULLET_Y_OFFSET: 2
};

interface CaseStudy {
    id: string;
    patient_id: string;
    highlight_text: string;
    created_at: string;
    patient_name?: string;
    interventions?: string[];
    outcomes?: string[];
    clinical_risks?: string[];
}

interface ExportPDFOptions {
    nursingHomeName: string;
    monthYear: string;
    caseStudies: CaseStudy[];
    logoPath?: string;
    categorizedInterventions: Record<string, string[]>;
    returnBlob?: boolean;

}

interface ExportDOCXOptions {
    nursingHomeName: string;
    monthYear: string;
    caseStudies: CaseStudy[];
    logoPath?: string;
    categorizedInterventions: Record<string, string[]>;
    returnBlob?: boolean;
}

export const exportToPDF = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    logoPath = "/placeholder-logo.png",
    categorizedInterventions,
    returnBlob = false
}: ExportPDFOptions): Promise<void | Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentPage = 1;
    let yPosition = 10;

    try {
        // Load and add logo
        const img = new Image();
        img.src = logoPath;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        const logoWidth = 40;
        const logoHeight = (img.height * logoWidth) / img.width;
        doc.addImage(img, 'PNG', (pageWidth - logoWidth) / 2, 10, logoWidth, logoHeight);

        yPosition += logoHeight + 10;

        // Title section with new colors
        doc.setTextColor(COLORS.TITLE);
        doc.setFontSize(24);
        doc.setFont('helvetica', 'bold');
        doc.text(nursingHomeName, pageWidth / 2, yPosition, { align: 'center' });

        yPosition += 10;
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(`Case Study Report - ${monthYear}`, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 20;

        // Helper function for section headers
        const addSectionHeader = (text: string) => {
            doc.setTextColor(COLORS.TITLE);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(text, 20, yPosition);
            yPosition += 12;
        };

        // Helper function for bullet points
        const addListItems = (items: string[]) => {
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(COLORS.BULLET_TEXT);

            items.forEach(item => {
                if (yPosition > pageHeight - 40) {
                    addFooter(doc);
                    doc.addPage();
                    currentPage++;
                    yPosition = 30;
                    doc.setFontSize(11);
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(COLORS.BULLET_TEXT);
                }

                // Draw bullet point
                doc.setFillColor(COLORS.BULLET_TEXT);
                doc.circle(20 + BULLET_STYLE.INDENT, yPosition + 3, BULLET_STYLE.RADIUS, 'F');

                // Text with proper color
                const maxWidth = pageWidth - BULLET_STYLE.TEXT_INDENT - 40;
                const lines = doc.splitTextToSize(item, maxWidth);

                lines.forEach((line: string, index: number) => {
                    doc.text(line, 20 + BULLET_STYLE.TEXT_INDENT, yPosition + 4 + (index * BULLET_STYLE.LINE_HEIGHT));
                });

                yPosition += (lines.length * BULLET_STYLE.LINE_HEIGHT) + 3;
            });
            yPosition += 5;
        };

        const addFooter = (doc: jsPDF) => {
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const footerY = pageHeight - 15;

            // Footer content
            const puzzleText = 'puzzle';
            const pageText = `${doc.getCurrentPageInfo().pageNumber}`;

            // Styles
            doc.setFontSize(14);
            doc.setTextColor(COLORS.PUZZLE_BLUE);

            // Position puzzle text and page number at the right end
            const pageTextWidth = doc.getTextWidth(pageText);
            const padding = 6;
            const bgWidth = pageTextWidth + padding;
            const puzzleTextWidth = doc.getTextWidth(puzzleText);
            const totalWidth = puzzleTextWidth + 5 + bgWidth;

            const puzzleX = pageWidth - 15 - totalWidth;
            doc.text(puzzleText, puzzleX, footerY);

            doc.setFontSize(10);
            const bgX = puzzleX + puzzleTextWidth + 5;

            doc.setFillColor(COLORS.PAGE_NUMBER);
            doc.roundedRect(bgX, footerY - 8, bgWidth, 12, 2, 2, 'F');

            // Centered page number
            const textX = bgX + (bgWidth - pageTextWidth) / 2;
            const textY = footerY - 1;
            doc.setTextColor(255, 255, 255);
            doc.text(pageText, textX, textY);
        };

        // Patient Snapshot Overview (when implemented)
        addSectionHeader('Patient Snapshot Overview: 30-Day Readmissions');
        yPosition += 5;

        // Interventions Section
        addSectionHeader('Interventions Delivered');
        Object.entries(categorizedInterventions)
            .filter(([_, items]) => items.length > 0)
            .forEach(([subcategory, items]) => {
                if (yPosition > pageHeight - 50) {
                    addFooter(doc);
                    doc.addPage();
                    currentPage++;
                    yPosition = 30;
                }

                doc.setTextColor(COLORS.TITLE);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(subcategory, 20, yPosition);
                yPosition += 8;

                addListItems(items);
            });

        // Puzzle Touchpoints Section
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        yPosition += 10; // Add extra space before section
        addSectionHeader('Puzzle Touchpoints');
        yPosition += 5;

        // Outcomes Section
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        addSectionHeader('Key Interventions and Outcomes');
        const uniqueOutcomes = [...new Set(caseStudies.flatMap(study => study.outcomes || []).filter(Boolean))];
        addListItems(uniqueOutcomes);

        // Clinical Risks Section
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        yPosition += 10; // Add extra space before section
        addSectionHeader('Top Clinical Risks Identified at Discharge');
        const uniqueRisks = [...new Set(caseStudies.flatMap(study => study.clinical_risks || []).filter(Boolean))];
        addListItems(uniqueRisks.slice(0, 30));

        if (uniqueRisks.length > 30) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(128, 128, 128); // Gray color for note
            doc.text('Showing top 30 risks. Refine in filters for more detail.', 27, yPosition);
            yPosition += 10;
        }

        // Case Studies Section - one card per row
        yPosition += 10;
        addSectionHeader('Case Studies');
        const CARD_WIDTH = pageWidth - 30; // Reduced side margins
        const CARD_PADDING = 8; // Reduced padding inside card
        const CARD_MARGIN = 8; // Increased margin between cards

        // Helper function to convert hex to RGB
        const hexToRgb = (hex: string): number[] => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result
                ? [
                    parseInt(result[1], 16),
                    parseInt(result[2], 16),
                    parseInt(result[3], 16)
                ]
                : [255, 255, 255];
        };

        let cardIndex = 0;
        const handleCardContent = (study: CaseStudy, yPos: number) => {
            const theme = cardIndex % 2 === 0 ? COLORS.CARD1 : COLORS.CARD2;

            doc.setFontSize(11); // Reduced font size
            const textLines = doc.splitTextToSize(study.highlight_text, CARD_WIDTH - (CARD_PADDING * 2 + 2));
            const lineSpacing = 6;
            const textHeight = textLines.length * lineSpacing;
            let cardHeight = Math.max(35, textHeight + 20);

            // If card would go beyond page and we're not at page top
            if (yPos > 30 && yPos + cardHeight > pageHeight - 30) {
                const remainingSpace = pageHeight - 30 - yPos;
                const linesPerPage = Math.floor((remainingSpace - 20) / lineSpacing);

                if (linesPerPage >= 2) {
                    // First part - use same theme
                    const firstPart = textLines.slice(0, linesPerPage);
                    const firstHeight = Math.max(40, 20 + firstPart.length * lineSpacing);

                    renderCard(study.patient_name || 'Unknown Patient', firstPart, yPos, firstHeight, theme);

                    addFooter(doc);
                    doc.addPage();
                    currentPage++;

                    // Second part - use same theme
                    const secondPart = textLines.slice(linesPerPage);
                    cardHeight = Math.max(40, 20 + secondPart.length * lineSpacing);
                    renderCard(study.patient_name || 'Unknown Patient', secondPart, 30, cardHeight, theme);
                    cardIndex++; // Only increment once for split cards
                    return 30 + cardHeight + CARD_MARGIN;
                }
            }

            renderCard(study.patient_name || 'Unknown Patient', textLines, yPos, cardHeight, theme);
            cardIndex++;
            return yPos + cardHeight + CARD_MARGIN;
        };

        const renderCard = (patientName: string, textLines: string[], yPos: number, height: number, theme: typeof COLORS.CARD1) => {
            // Convert hex colors to RGB for background
            const bgColor = hexToRgb(theme.BACKGROUND);

            // Draw card background and border
            doc.setDrawColor(theme.BORDER);
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.setLineWidth(0.5);
            doc.roundedRect(20, yPos, CARD_WIDTH, height, 3, 3, 'FD');

            // Patient name
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(theme.TITLE);
            doc.text(patientName, 20 + CARD_PADDING, yPos + 10);

            // Text content
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(theme.TEXT);
            doc.setFontSize(11);
            doc.text(textLines, 20 + CARD_PADDING, yPos + 20);
        };

        // Process case studies
        caseStudies.forEach((study, index) => {
            if (yPosition + 60 > pageHeight - 30) {
                addFooter(doc);
                doc.addPage();
                currentPage++;
                yPosition = 30;
            }

            yPosition = handleCardContent(study, yPosition);
        });

        // Add footer to the last page
        addFooter(doc);

        // Return blob or save file based on returnBlob option
        if (returnBlob) {
            const pdfBlob = doc.output('blob');
            return pdfBlob;
        } else {
            doc.save(`${nursingHomeName}-case-studies-${monthYear}.pdf`);
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};

const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

const DOCX_CONSTANTS = {
    // Convert mm to DOCX units (EMUs)
    // 1mm = 36000 EMUs
    LOGO_WIDTH: 36000 * 80, // 80mm width
    LOGO_HEIGHT: 36000 * 30, // 30mm height - maintains 8:3 aspect ratio
    PAGE_MARGIN: {
        TOP: 36000 * 25,    // 25mm
        BOTTOM: 36000 * 25, // 25mm
        LEFT: 36000 * 40,   // 40mm
        RIGHT: 36000 * 25,  // 25mm
    },
    CONTENT: {
        INDENT: {
            LEFT: 36000 * 2,  // 2mm left indentation for content
            RIGHT: 36000 * 2, // 2mm right indentation for content
        },
        SPACING: {
            BEFORE: 200,
            AFTER: 200,
        }
    },
    SECTIONS: {
        SPACING: {
            BEFORE: 400,
            AFTER: 200,
        }
    },
    HEADER: {
        SPACING: 400,
    },
    CARD: {
        INDENT: 36000 * 10,    // 10mm indentation for cards
        SPACING: 200,          // Spacing between cards
    },
};

const hexToDocxColor = (hex: string): string => {
    return hex.replace('#', '');
};

const createDocxFooter = (currentPage: number) => [
    new Paragraph({
        children: [
            new TextRun({
                text: "puzzle",
                color: hexToDocxColor(COLORS.PUZZLE_BLUE),
                size: 28, // 14pt
            }),
            new TextRun({
                text: " ",
                size: 28,
            }),
            new TextRun({
                text: `${currentPage}`,
                color: hexToDocxColor(COLORS.PAGE_NUMBER),
                size: 20, // 10pt
                highlight: "cyan", // Using predefined color that matches closest to our blue
            }),
        ],
        spacing: { before: 200 },
        alignment: AlignmentType.RIGHT,
    }),
];

export const exportToDOCX = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    logoPath = "/placeholder-logo.png",
    categorizedInterventions,
    returnBlob = false
}: ExportDOCXOptions): Promise<Blob | void> => {
    try {
        // Load logo image as ArrayBuffer
        const loadImage = async (url: string): Promise<ArrayBuffer> => {
            try {
                // For absolute URLs, use fetch directly
                if (url.startsWith('http')) {
                    const response = await fetch(url);
                    const blob = await response.blob();
                    return await blob.arrayBuffer();
                }
                
                // For local files, prepend the public directory path
                const response = await fetch(url.startsWith('/') ? url : `/${url}`);
                if (!response.ok) {
                    throw new Error(`Failed to load image: ${response.statusText}`);
                }
                const blob = await response.blob();
                return await blob.arrayBuffer();
            } catch (error) {
                console.error('Error loading logo:', error);
                // Fallback to placeholder logo
                const fallbackResponse = await fetch('/placeholder-logo.png');
                const fallbackBlob = await fallbackResponse.blob();
                return await fallbackBlob.arrayBuffer();
            }
        };

        // Image data
        const imageData = await loadImage(logoPath);

        const styles: IStylesOptions = {
            paragraphStyles: [
                {
                    id: "Title",
                    name: "Title",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        size: 48, // 24pt
                        bold: true,
                        color: COLORS.TITLE.replace('#', ''),
                        font: "Arial",
                    },
                },
                {
                    id: "Heading",
                    name: "Heading",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        size: 32, // 16pt
                        bold: true,
                        color: COLORS.TITLE.replace('#', ''),
                        font: "Arial",
                    },
                },
                {
                    id: "SubHeading",
                    name: "SubHeading",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        size: 24, // 12pt
                        bold: true,
                        color: COLORS.TITLE.replace('#', ''),
                        font: "Arial",
                    },
                },
                {
                    id: "BulletText",
                    name: "BulletText",
                    basedOn: "Normal",
                    next: "Normal",
                    run: {
                        size: 22, // 11pt
                        color: COLORS.BULLET_TEXT.replace('#', ''),
                        font: "Arial",
                    },
                }
            ],
        };

        const doc = new Document({
            title: `${nursingHomeName} - Case Studies Report`,
            description: `Case Studies Report for ${nursingHomeName} - ${monthYear}`,
            styles,
            sections: [{
                properties: {
                    page: {
                        margin: {
                            top: DOCX_CONSTANTS.PAGE_MARGIN.TOP,
                            bottom: DOCX_CONSTANTS.PAGE_MARGIN.BOTTOM,
                            right: DOCX_CONSTANTS.PAGE_MARGIN.RIGHT,
                            left: DOCX_CONSTANTS.PAGE_MARGIN.LEFT,
                        },
                    },
                },
                footers: {
                    default: new Footer({
                        children: createDocxFooter(1),
                    }),
                },
                children: [
                    // Logo
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageData,
                                transformation: {
                                    width: DOCX_CONSTANTS.LOGO_WIDTH,
                                    height: DOCX_CONSTANTS.LOGO_HEIGHT,
                                },
                                type: 'png',
                                floating: {
                                    zIndex: 1,
                                    horizontalPosition: {
                                        relative: 'margin',
                                        align: 'center',
                                    },
                                    verticalPosition: {
                                        relative: 'margin',
                                        align: 'top',
                                    },
                                },
                            }),
                        ],
                        spacing: { before: 400, after: 400 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: nursingHomeName,
                                size: 48,
                                bold: true,
                                color: COLORS.TITLE.replace('#', ''),
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `Case Study Report - ${monthYear}`,
                                size: 32,
                                color: COLORS.TITLE.replace('#', ''),
                            }),
                        ],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 400 },
                    }),

                    // Patient Snapshot Overview
                    new Paragraph({
                        text: "Patient Snapshot Overview: 30-Day Readmissions",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                        style: "Heading",
                    }),

                    // Interventions Section
                    new Paragraph({
                        text: "Interventions Delivered",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                        style: "Heading",
                    }),
                    ...Object.entries(categorizedInterventions)
                        .filter(([_, items]) => items.length > 0)
                        .flatMap(([subcategory, items]) => [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: subcategory,
                                        size: 24,
                                        bold: true,
                                        color: COLORS.TITLE.replace('#', ''),
                                    }),
                                ],
                                spacing: { before: 200, after: 100 },
                            }),
                            ...items.map(
                                (item) =>
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: "• ", size: 22 }),
                                            new TextRun({
                                                text: item,
                                                size: 22,
                                                color: COLORS.BULLET_TEXT.replace('#', ''),
                                            }),
                                        ],
                                        spacing: { before: 100 },
                                        style: "BulletText",
                                    })
                            ),
                        ]),

                    // Outcomes Section
                    new Paragraph({
                        text: "Key Interventions and Outcomes",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                        style: "Heading",
                    }),
                    ...caseStudies
                        .flatMap((study) => study.outcomes || [])
                        .filter((outcome): outcome is string => Boolean(outcome))
                        .filter((outcome, index, self) => self.indexOf(outcome) === index)
                        .map(
                            (outcome) =>
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "• ", size: 22 }),
                                        new TextRun({
                                            text: outcome,
                                            size: 22,
                                            color: COLORS.BULLET_TEXT.replace('#', ''),
                                        }),
                                    ],
                                    spacing: { before: 100 },
                                    style: "BulletText",
                                })
                        ),

                    // Clinical Risks Section
                    new Paragraph({
                        text: "Top Clinical Risks Identified at Discharge",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: 400, after: 200 },
                        style: "Heading",
                    }),
                    ...caseStudies
                        .flatMap((study) => study.clinical_risks || [])
                        .filter((risk): risk is string => Boolean(risk))
                        .filter((risk, index, self) => self.indexOf(risk) === index)
                        .slice(0, 30)
                        .map(
                            (risk) =>
                                new Paragraph({
                                    children: [
                                        new TextRun({ text: "• ", size: 22 }),
                                        new TextRun({
                                            text: risk,
                                            size: 22,
                                            color: COLORS.BULLET_TEXT.replace('#', ''),
                                        }),
                                    ],
                                    spacing: { before: 100 },
                                    style: "BulletText",
                                })
                        ),

                    // Note for truncated risks
                    ...(caseStudies.flatMap(s => s.clinical_risks || []).length > 30 ? [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Showing top 30 risks. Refine in filters for more detail.",
                                    size: 18,
                                    color: "808080",
                                    italics: true,
                                }),
                            ],
                            spacing: { before: 200 },
                        }),
                    ] : []),

                    // Case Studies Section
                    new Paragraph({
                        text: "Case Studies",
                        heading: HeadingLevel.HEADING_1,
                        spacing: { before: DOCX_CONSTANTS.HEADER.SPACING, after: 200 },
                        style: "Heading",
                    }),
                    ...caseStudies.flatMap((study, index) => {
                        const theme = index % 2 === 0 ? COLORS.CARD1 : COLORS.CARD2;
                        return [
                            // Patient name paragraph
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: study.patient_name || "Unknown Patient",
                                        size: 24,
                                        bold: true,
                                        color: hexToDocxColor(theme.TITLE),
                                    }),
                                ],
                                spacing: { before: 120, after: 0 },
                                indent: { left: DOCX_CONSTANTS.CARD.INDENT, right: DOCX_CONSTANTS.CARD.INDENT },
                                shading: { fill: hexToDocxColor(theme.BACKGROUND), type: 'clear' },
                                border: {
                                    top: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                    bottom: { style: BorderStyle.NONE },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                }
                            }),
                            // Card content paragraph
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: study.highlight_text,
                                        size: 22,
                                        color: hexToDocxColor(theme.TEXT),
                                    }),
                                ],
                                spacing: { before: 120, after: DOCX_CONSTANTS.CARD.SPACING },
                                indent: { left: DOCX_CONSTANTS.CARD.INDENT, right: DOCX_CONSTANTS.CARD.INDENT },
                                shading: { fill: hexToDocxColor(theme.BACKGROUND), type: 'clear' },
                                border: {
                                    top: { style: BorderStyle.NONE },
                                    bottom: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                    left: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                    right: { style: BorderStyle.SINGLE, size: 1, color: hexToDocxColor(theme.BORDER) },
                                }
                            }),
                        ];
                    }),
                ],
            }],
        });

        const blob = await Packer.toBlob(doc);

        if (returnBlob) {
            return blob;
        } else {
            downloadFile(blob, `${nursingHomeName}-case-studies-${monthYear}.docx`);
        }

    } catch (error) {
        console.error('Error generating DOCX:', error);
        throw error;
    }
};

export const generatePatientCards = (doc: jsPDF, patients: any[], startY: number) => {
    const pageWidth = doc.internal.pageSize.width;
    const CARD_WIDTH = (pageWidth - 50) / 3;
    const CARD_PADDING = 5;
    const CARD_HEIGHT = 60;

    patients.forEach((patient, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 20 + (col * (CARD_WIDTH + 5));
        const y = startY + (row * (CARD_HEIGHT + 10));

        // Draw card background with rounded corners
        doc.setFillColor(COLORS.LIGHT_GRAY);
        doc.roundedRect(x, y, CARD_WIDTH, CARD_HEIGHT, 3, 3, 'F');

        // Patient name
        doc.setFontSize(12);
        doc.setTextColor(COLORS.PATIENT_NAME);
        doc.text(patient.name, x + CARD_PADDING, y + 15);

        // Patient details
        doc.setFontSize(10);
        doc.setTextColor(COLORS.PATIENT_DETAILS);
        doc.text(patient.details, x + CARD_PADDING, y + 30);
    });

    return startY + (Math.ceil(patients.length / 3) * (CARD_HEIGHT + 10));
};

export const addBulletPoint = (doc: jsPDF, text: string, x: number, y: number) => {
    doc.setFillColor(COLORS.BULLET_TEXT);
    doc.circle(x + BULLET_STYLE.INDENT, y + BULLET_STYLE.BULLET_Y_OFFSET, BULLET_STYLE.RADIUS, 'F');
    doc.text(text, x + BULLET_STYLE.TEXT_INDENT, y + BULLET_STYLE.LINE_HEIGHT);
    return y + BULLET_STYLE.LINE_HEIGHT + 5;
};

export const addSectionTitle = (doc: jsPDF, title: string, x: number, y: number) => {
    doc.setFontSize(14);
    doc.setTextColor(COLORS.TITLE);
    doc.setFont('helvetica', 'bold');
    doc.text(title, x, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    return y + 10;
};
