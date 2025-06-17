import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType } from 'docx';
import html2canvas from 'html2canvas';


const COLORS = {
    PUZZLE_BLUE: '#28317c',
    PAGE_NUMBER: '#11b3dc',
    TITLE: '#1e40af',
    SUB_TITLE: '#3b82f6',
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
    chartRef?: HTMLDivElement | null; // Deprecated - kept for backward compatibility
    readmissionsChartRef?: HTMLDivElement | null;
    touchpointsChartRef?: HTMLDivElement | null;
    clinicalRisksChartRef?: HTMLDivElement | null;
}

interface ExportDOCXOptions {
    nursingHomeName: string;
    monthYear: string;
    caseStudies: CaseStudy[];
    logoPath?: string;
    categorizedInterventions: Record<string, string[]>;
    returnBlob?: boolean;
    readmissionsChartRef?: HTMLDivElement | null;
    touchpointsChartRef?: HTMLDivElement | null;
    clinicalRisksChartRef?: HTMLDivElement | null;
}

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


export const exportToPDF = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    logoPath = "/puzzle_background.png",
    categorizedInterventions,
    returnBlob = false,
    chartRef = null, // Deprecated
    readmissionsChartRef = null,
    touchpointsChartRef = null,
    clinicalRisksChartRef = null
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

        addSectionHeader('Patient Snapshot Overview: 30-Day Readmissions');

        // Add chart if available
        if (readmissionsChartRef) {
            const result = await renderChart(doc, readmissionsChartRef, yPosition, 'Readmissions chart rendering error:');
            yPosition = result.newYPosition;
        }

        // Interventions Section
        addSectionHeader('Types of Interventions Delivered');
        Object.entries(categorizedInterventions)
            .filter(([_, items]) => items.length > 0)
            .forEach(([subcategory, items]) => {
                if (yPosition > pageHeight - 50) {
                    addFooter(doc);
                    doc.addPage();
                    currentPage++;
                    yPosition = 30;
                }

                doc.setTextColor(COLORS.SUB_TITLE);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(subcategory, 20, yPosition);
                yPosition += 5;

                addListItems(items);
            });

        // Puzzle Touchpoints Section with Chart
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        yPosition += 10;
        addSectionHeader('Puzzle Touchpoints');

        // Add Puzzle Touchpoints chart if available
        if (touchpointsChartRef) {
            const result = await renderChart(doc, touchpointsChartRef, yPosition, 'Touchpoints chart rendering error:');
            yPosition = result.newYPosition;
        }
        yPosition += 5;

        // Clinical Risks Section with Chart
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        yPosition += 10;
        addSectionHeader('Top Clinical Risks Identified at Discharge');

        // Add Clinical Risks chart if available
        if (clinicalRisksChartRef) {
            const result = await renderChart(doc, clinicalRisksChartRef, yPosition, 'Clinical risks chart rendering error:');
            yPosition = result.newYPosition;
        }
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

        // Case Studies Section with box layout
        yPosition += 10;
        yPosition = addCaseStudiesSection(doc, caseStudies, yPosition, pageWidth, pageHeight, addFooter);
     
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
    returnBlob = false,
    readmissionsChartRef = null,
    touchpointsChartRef = null,
    clinicalRisksChartRef = null
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

        const readmissionsChartData = await convertChartToImage(readmissionsChartRef);
        const touchpointsChartData = await convertChartToImage(touchpointsChartRef);
        const clinicalRisksChartData = await convertChartToImage(clinicalRisksChartRef);

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
                    ...(readmissionsChartData ? [
                        new Paragraph({
                            children: [createChartImage(readmissionsChartData)],
                            spacing: { before: 200, after: 400 },
                            alignment: AlignmentType.CENTER,
                        }),
                    ] : []),

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

                    // Puzzle Touchpoints Section
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
                    ...(touchpointsChartData ? [
                        new Paragraph({
                            children: [createChartImage(touchpointsChartData)],
                            spacing: { before: 200, after: 400 },
                            alignment: AlignmentType.CENTER,
                        }),
                    ] : []),

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
                    ...(clinicalRisksChartData ? [
                        new Paragraph({
                            children: [createChartImage(clinicalRisksChartData)],
                            spacing: { before: 200, after: 400 },
                            alignment: AlignmentType.CENTER,
                        }),
                    ] : []),

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

const addCaseStudiesSection = (
    doc: jsPDF,
    caseStudies: CaseStudy[],
    yPosition: number,
    pageWidth: number,
    pageHeight: number,
    addFooter: (doc: jsPDF) => void
) => {
    // Add section header
    doc.setTextColor(COLORS.TITLE);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Case Study Highlights', 20, yPosition);
    yPosition += 12;

    const boxLeftMargin = 20;
    const boxWidth = pageWidth - 40;
    const boxPadding = 5;
    const borderWidth = 2;
    const separatorWidth = 0.2;
    const textStartX = boxLeftMargin + boxPadding + borderWidth + 5;

    let currentPage = doc.getCurrentPageInfo().pageNumber;

    caseStudies.forEach((study, index) => {
        // Calculate dimensions first
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        const textLines = doc.splitTextToSize(
            study.highlight_text,
            boxWidth - (boxPadding * 2 + borderWidth + 10)
        );
        const textHeight = textLines.length * 5.5 + 12;
        const boxHeight = Math.max(35, textHeight + boxPadding);

        // Check if we need a new page
        if (yPosition + boxHeight + 10 > pageHeight - 30) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
            doc.setTextColor(COLORS.TITLE);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            yPosition += 12;
        }

        // Draw the box
        doc.setFillColor(255, 255, 255);
        doc.rect(boxLeftMargin, yPosition, boxWidth, boxHeight, 'F');
        const bgColor = hexToRgb("#1A85FF");
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.rect(boxLeftMargin, yPosition, borderWidth, boxHeight, 'F');

        // Add patient name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(COLORS.PATIENT_NAME);
        doc.text(study.patient_name || 'Unknown Patient', textStartX, yPosition + boxPadding + 4);

        // Add case study text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(85, 85, 85);
        doc.text(textLines, textStartX, yPosition + boxPadding + 14);

        // Add separator line
        if (index < caseStudies.length - 1) {
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(separatorWidth);
            doc.line(
                boxLeftMargin,
                yPosition + boxHeight,
                boxLeftMargin + boxWidth,
                yPosition + boxHeight
            );
        }

        yPosition += boxHeight + 8;

        // Add footer if this is the last item on the page
        if (index < caseStudies.length - 1 && yPosition + boxHeight + 10 > pageHeight - 30) {
            addFooter(doc);
        }
    });

    return yPosition + 15;
};

// Add after BULLET_STYLE const

const renderChart = async (doc: jsPDF, chartRef: HTMLDivElement | null, yPosition: number, errorMessage: string): Promise<{ newYPosition: number, error?: Error }> => {
    if (!chartRef) {
        return { newYPosition: yPosition };
    }

    try {
        const width = Math.max(chartRef.clientWidth || 600, 600);
        const height = Math.max(chartRef.clientHeight || 400, 400);
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            width: `${width}px`,
            height: `${height}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            zIndex: '-1'
        });

        const clone = chartRef.cloneNode(true) as HTMLElement;
        clone.style.width = '100%';
        clone.style.height = '100%';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 10000
        });

        document.body.removeChild(wrapper);

        const chartImage = canvas.toDataURL('image/png', 1.0);
        if (chartImage.length < 100) throw new Error('Invalid chart image generated.');

        const maxWidth = pageWidth * 0.85;
        const maxHeight = pageHeight * 0.4;

        let imgWidth = maxWidth;
        let imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = (canvas.width * imgHeight) / canvas.height;
        }

        const x = (pageWidth - imgWidth) / 2;
        doc.addImage(chartImage, 'PNG', x, yPosition, imgWidth, imgHeight, undefined, 'FAST');
        return { newYPosition: yPosition + imgHeight + 20 };

    } catch (err) {
        console.error(errorMessage, err);
        doc.setTextColor('#ff0000');
        doc.setFontSize(10);
        doc.text('Error: Unable to render chart section.', 20, yPosition);
        return { newYPosition: yPosition + 10, error: err as Error };
    }
};

const convertChartToImage = async (chartRef: HTMLDivElement | null): Promise<ArrayBuffer | undefined> => {
    if (!chartRef) return undefined;

    try {
        const width = Math.max(chartRef.clientWidth || 600, 600);
        const height = Math.max(chartRef.clientHeight || 400, 400) *2;

        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            width: `${width}px`,
            height: `${height}px`,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#ffffff',
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            zIndex: '-1'
        });

        const clone = chartRef.cloneNode(true) as HTMLElement;
        clone.style.width = '100%';
        clone.style.height = '100%';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 10000
        });

        document.body.removeChild(wrapper);

        const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
        });

        return await blob.arrayBuffer();
    } catch (error) {
        console.error('Error converting chart to image:', error);
        return undefined;
    }
};

const createChartImage = (imageData: ArrayBuffer): ImageRun => {
    return new ImageRun({
        data: imageData,
        transformation: {
            width: 600,
            height: 600,
        },
        type: 'png',
    });
};

