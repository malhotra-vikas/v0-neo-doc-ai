import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType } from 'docx';

const COLORS = {
    PUZZLE_BLUE: '#28317c',
    PAGE_NUMBER: '#11b3dc',
    TITLE: '#2e3771',
    BULLET_TEXT: '#6b789a',
    PATIENT_NAME: '#858387',
    PATIENT_DETAILS: '#bab4bf',
    LIGHT_GRAY: '#e5e7eb',
    CARD1: {
        BACKGROUND: '#ffffff',
        TITLE: '#97939a',
        TEXT: '#8a8a8e',
        BORDER: '#5d6a90'
    },
    CARD2: {
        BACKGROUND: '#ffffff',
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
    logoPath = "/puzzle_background.png",
    categorizedInterventions,
    returnBlob = false
}: ExportPDFOptions): Promise<void | Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentPage = 1;
    let yPosition = 10;

    try {
        // Load and add full-width header image
        const img = new Image();
        img.src = logoPath;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });

        // Make image take half the page height
        const targetHeight = pageHeight / 2;
        const targetWidth = pageWidth;
        doc.addImage(img, 'PNG', 0, 0, targetWidth, targetHeight);

        // Position text after the existing line (around 55% of page width)
        const lineX = pageWidth * 0.48; // Position after the line
        const textY = targetHeight * 0.42; // Move text up slightly for better centering
        const textX = lineX + 10; // Position text after the line

        doc.setTextColor(255, 255, 255); // White text

        // Nursing home name - with text wrapping if needed
        const maxWidth = pageWidth * 0.4; // Maximum width for text
        doc.setFontSize(18); // Slightly smaller font
        doc.setFont('helvetica', 'bold');

        // Handle text wrapping for nursing home name
        const nameLines = doc.splitTextToSize(nursingHomeName, maxWidth);
        nameLines.forEach((line: string, index: number) => {
            doc.text(line, textX, textY + (index * 15)); // Reduced line spacing to 15
        });

        // Month and year - minimal spacing after name
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.text(monthYear, textX, textY + (nameLines.length * 10)); // Only 1 unit gap

        yPosition = targetHeight + 20;

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

                // Adjusted spacing between bullet points — removed +3
                yPosition += (lines.length * BULLET_STYLE.LINE_HEIGHT) + 1; // minimal padding between bullets
            });

            // Optional spacing after the whole list
            yPosition += 5;
        };


        const addFooter = (doc: jsPDF) => {
            const pageWidth = doc.internal.pageSize.width;
            const pageHeight = doc.internal.pageSize.height;
            const footerY = pageHeight - 5;

            // Footer content
            const puzzleText = 'puzzle';
            const pageText = `${doc.getCurrentPageInfo().pageNumber}`;

            // Styles for puzzle text
            doc.setFontSize(12);
            doc.setTextColor(COLORS.PUZZLE_BLUE);

            // Calculate positions
            const puzzleTextWidth = doc.getTextWidth(puzzleText);
            const pageTextWidth = doc.getTextWidth(pageText);
            const totalWidth = puzzleTextWidth + 2 + pageTextWidth;
            // Position both elements from the right
            const startX = pageWidth - 5 - totalWidth;

            // Draw puzzle text
            doc.text(puzzleText, startX, footerY);

            // Draw page number
            doc.setFontSize(12);
            doc.setTextColor(COLORS.PAGE_NUMBER);
            doc.text(pageText, startX + puzzleTextWidth + 2, footerY);
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
                yPosition += 5;

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
    LOGO_WIDTH: 792,  // Full page width (8.25 inches * 96 dpi)
    LOGO_HEIGHT: 528, // Half page height (5.5 inches * 96 dpi)
    PAGE_MARGIN: {
        TOP: 1200,      // No top margin for image
        BOTTOM: 25,
        LEFT: 72,    // Standard margins
        RIGHT: 72,   // Standard margins
    },
    CONTENT: {
        INDENT: {
            LEFT: 60,
            RIGHT: 60,
        },
        SPACING: {
            BEFORE: 500,
            AFTER: 500,
        }
    },
    SECTIONS: {
        SPACING: {
            BEFORE: 800,
            AFTER: 400,
        }
    },
    HEADER: {
        SPACING: 800,
    },
    CARD: {
        INDENT: 500,    // Reduced indent to match PDF
        SPACING: 400,   // Space between cards
        PADDING: {
            TOP: 240,    // Internal padding top
            AFTER_NAME: 160, // Space after name
            CONTENT: 240,    // Content padding
            BOTTOM: 240      // Bottom padding
        }
    },
};

const hexToDocxColor = (hex: string): string => {
    return hex.replace('#', '');
};

const createDocxFooter = () => [
    new Paragraph({
        children: [
            new TextRun({
                text: "puzzle",
                color: hexToDocxColor(COLORS.PUZZLE_BLUE),
                size: 24,
                font: "Nimbus Sans",
            }),
            new TextRun({
                children: [" "],
                size: 24,
            }),
            new TextRun({
                children: [PageNumber.CURRENT],
                color: hexToDocxColor(COLORS.PAGE_NUMBER),
                size: 24,
                font: "Nimbus Sans",
            }),
        ],
        spacing: { before: 100, after: 0 },
        alignment: AlignmentType.RIGHT,
        indent: { right: 180 },
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
                        font: "Nimbus Sans",
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
                        font: "Nimbus Sans",
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
                        font: "Nimbus Sans",
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
                        font: "Nimbus Sans",
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
                        children: createDocxFooter(),
                    }),
                },
                children: [
                    // Logo and Header Section combined
                    new Paragraph({
                        children: [
                            new ImageRun({
                                data: imageData,
                                transformation: {
                                    width: DOCX_CONSTANTS.LOGO_WIDTH,
                                    height: DOCX_CONSTANTS.LOGO_HEIGHT,
                                },
                                floating: {
                                    horizontalPosition: {
                                        relative: 'page',
                                        align: 'center',
                                    },
                                    verticalPosition: {
                                        relative: 'page',
                                        offset: 0,
                                    },
                                    allowOverlap: true,
                                    behindDocument: true,
                                    zIndex: -1,
                                },
                                type: 'png',
                            }),
                        ],
                        spacing: { before: 0, after: 0 },
                    }),

                    // Header text overlaying the image - nursing home name
                    new Paragraph({
                        children: [
                            // Split nursing home name into words and add breaks for long words
                            ...nursingHomeName.split(' ').map((word, i, arr) => [
                                new TextRun({
                                    text: word,
                                    size: 40,
                                    bold: true,
                                    color: 'FFFFFF',
                                }),
                                // Add line break if word is too long
                                word.length > 25 ?
                                    new TextRun({ break: 1 }) :
                                    new TextRun({ text: ' ', size: 40, color: 'FFFFFF' }),
                            ]).flat(),
                        ],
                        // alignment: AlignmentType.CENTER,
                        indent: {
                            left: 6000,
                            right: 1000,
                        },
                        spacing: { before: 2900, after: 100 },
                    }),

                    // Year text below the line
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: monthYear,
                                size: 32,
                                color: 'FFFFFF',
                            }),
                        ],
                        indent: {
                            left: 6000,
                            right: 1000,
                        },
                        spacing: { before: 0, after: 0 },
                    }),

                    // Add a spacer paragraph
                    new Paragraph({
                        text: "",
                        spacing: { before: DOCX_CONSTANTS.LOGO_HEIGHT + 1500 },
                    }),

                    // Patient Snapshot Overview
                    new Paragraph({
                        text: "Patient Snapshot Overview: 30-Day Readmissions",
                        heading: HeadingLevel.HEADING_1,
                        indent: {
                            left: 500,
                            right: 500,
                        },
                        spacing: { before: 2000, after: 200 },
                        style: "Heading",
                    }),

                    // Interventions Section
                    new Paragraph({
                        text: "Interventions Delivered",
                        heading: HeadingLevel.HEADING_1,
                        indent: {
                            left: 500,
                            right: 500,
                        },
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
                                indent: {
                                    left: 500,
                                    right: 500,
                                },
                                spacing: { before: 200, after: 100 },
                            }),
                            ...items.map(
                                (item) =>
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: "•   ", size: 22 }),
                                            new TextRun({
                                                text: item,
                                                size: 22,
                                                color: COLORS.BULLET_TEXT.replace('#', ''),
                                            }),
                                        ],
                                        indent: {
                                            left: 800,
                                            right: 800,
                                        },
                                        spacing: { before: 100 },
                                        style: "BulletText",
                                    })
                            ),
                        ]),

                    new Paragraph({
                        text: "Puzzle Touchpoints",
                        heading: HeadingLevel.HEADING_1,
                        indent: {
                            left: 500,
                            right: 500,
                        },
                        spacing: { before: 600, after: 200 },
                        style: "Heading",
                    }),


                    // Outcomes Section
                    new Paragraph({
                        text: "Key Interventions and Outcomes",
                        heading: HeadingLevel.HEADING_1,
                        indent: {
                            left: 500,
                            right: 500,
                        },
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
                                        new TextRun({ text: "•   ", size: 22 }),
                                        new TextRun({
                                            text: outcome,
                                            size: 22,
                                            color: COLORS.BULLET_TEXT.replace('#', ''),
                                        }),
                                    ],
                                    indent: {
                                        left: 800,
                                        right: 800,
                                    },
                                    spacing: { before: 100 },
                                    style: "BulletText",
                                })
                        ),

                    // Clinical Risks Section
                    new Paragraph({
                        text: "Top Clinical Risks Identified at Discharge",
                        heading: HeadingLevel.HEADING_1,
                        indent: {
                            left: 500,
                            right: 500,
                        },
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
                                        new TextRun({ text: "•   ", size: 22 }),
                                        new TextRun({
                                            text: risk,
                                            size: 22,
                                            color: COLORS.BULLET_TEXT.replace('#', ''),
                                        }),
                                    ],
                                    indent: {
                                        left: 800,
                                        right: 800,
                                    },
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
                            indent: {
                                left: 500,
                                right: 500,
                            },
                            spacing: { before: 200 },
                        }),
                    ] : []),

                    // Case Studies Section
                    new Paragraph({
                        text: "Case Studies",
                        heading: HeadingLevel.HEADING_1,
                        indent: { left: 500, right: 500 },
                        spacing: { before: 400, after: 400 },
                        style: "Heading",
                    }),
                   ...caseStudies.flatMap((study, index) => 
                        createCaseStudyCard(study, index % 2 === 0 ? COLORS.CARD1 : COLORS.CARD2)
                    ),
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
const createCaseStudyCard = (study: any, theme: any) => {
    return [
        // Spacer paragraph for top margin between cards
        new Paragraph({ spacing: { before: 400 } }),

        new Table({
            width: {
                size: 10500, 
                type: WidthType.DXA,
            },
            indent: {
                size: 500,
                type: WidthType.DXA,
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: {
                                top: { style: BorderStyle.SINGLE, size: 6, color: hexToDocxColor(theme.BORDER) },
                                bottom: { style: BorderStyle.SINGLE, size: 6, color: hexToDocxColor(theme.BORDER) },
                                left: { style: BorderStyle.SINGLE, size: 6, color: hexToDocxColor(theme.BORDER) },
                                right: { style: BorderStyle.SINGLE, size: 6, color: hexToDocxColor(theme.BORDER) },
                            },
                            shading: {
                                fill: hexToDocxColor(theme.BACKGROUND),
                            },
                            margins: {
                                top: 300,
                                bottom: 360,
                                left: 360,
                                right: 360,
                            },
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: study.patient_name || "Unknown Patient",
                                            bold: true,
                                            size: 24,
                                            color: hexToDocxColor(theme.TITLE),
                                            font: "Helvetica",
                                        }),
                                    ],
                                    spacing: {
                                        after: 280, // Increased spacing after patient name
                                        line: 360,
                                        lineRule: LineRuleType.AUTO,
                                        before: 80, // Added top spacing
                                    },
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: study.highlight_text,
                                            size: 22,
                                            color: hexToDocxColor(theme.TEXT),
                                            font: "Helvetica",
                                        }),
                                    ],
                                    spacing: {
                                        after: 140, // Increased bottom spacing
                                        line: 320, // Slightly increased line height
                                        lineRule: LineRuleType.AUTO,
                                        before: 140, // Added top spacing
                                    },
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        }),
    ];
};

