import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType, VerticalAlign, TableLayoutType } from 'docx';
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
    hospital_discharge_summary_text: string;
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

        yPosition += 10;
        addSectionHeader('Patient Snapshot Overview: 30-Day Readmissions');

        // Add chart if available
        if (readmissionsChartRef) {
            const result = await renderChart(doc, readmissionsChartRef, yPosition, 'Readmissions chart rendering error:');
            yPosition = result.newYPosition;
        }

        // Force this section to a new page
        addFooter(doc);
        doc.addPage();
        currentPage++;
        yPosition = 30;
        // Interventions Section
        addSectionHeader('Types of Interventions Delivered');

        // Log the full structure once
        console.log('🧩 categorizedInterventions:', JSON.stringify(categorizedInterventions, null, 2));

        Object.entries(categorizedInterventions)
            .filter(([_, items]) => items.length > 0)
            .forEach(([subcategory, items]) => {
                console.log(`📂 Subcategory: ${subcategory}`);

                const interventionTexts = items.map((item, idx) => {
                    console.log(`   - [${idx + 1}] ${item.intervention}`);
                    return item.intervention;
                });

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

                addListItems(interventionTexts);
            });

        // Puzzle Touchpoints Section with Chart
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        yPosition += 15;
        addSectionHeader('Puzzle Touchpoints');

        // Add Puzzle Touchpoints chart if available
        if (touchpointsChartRef) {
            const result = await renderChart(doc, touchpointsChartRef, yPosition, 'Touchpoints chart rendering error:');
            yPosition = result.newYPosition;
        }
        yPosition += 2;

        // Clinical Risks Section with Chart
        if (yPosition > pageHeight - 50) {
            addFooter(doc);
            doc.addPage();
            currentPage++;
            yPosition = 30;
        }
        addSectionHeader('Top Clinical Risks Identified at Discharge');

        // Add Clinical Risks chart if available
        if (clinicalRisksChartRef) {
            const result = await renderChart(doc, clinicalRisksChartRef, yPosition, 'Clinical risks chart rendering error:');
            yPosition = result.newYPosition;
        }
        yPosition += 5;

        // Outcomes Section
        addFooter(doc);
        doc.addPage();
        currentPage++;
        yPosition = 30;
        addSectionHeader('Key Interventions and Outcomes');
        const outcomeTexts = [
            ...new Set(
                caseStudies
                    .flatMap(study => study.outcomes || [])
                    .map((item) => {
                        try {
                            const parsed = typeof item === "string" ? JSON.parse(item) : item
                            return parsed.outcome?.trim()
                        } catch {
                            return null
                        }
                    })
                    .filter(Boolean)
            )
        ];

        console.log("Outcome text is ", outcomeTexts)

        addListItems(outcomeTexts);

        // Clinical Risks Section
        addFooter(doc);
        doc.addPage();
        currentPage++;
        yPosition = 30;
        yPosition += 10; // Add extra space before section
        addSectionHeader('Top Clinical Risks Identified at Discharge');

        const uniqueRisks = [
            ...new Set(
                caseStudies
                    .flatMap(study => study.clinical_risks || [])
                    .map((item) => {
                        try {
                            const parsed = typeof item === "string" ? JSON.parse(item) : item
                            return parsed.risk?.trim()
                        } catch {
                            return null
                        }
                    })
                    .filter(Boolean)
            )
        ];

        addListItems(uniqueRisks.slice(0, 30));

        if (uniqueRisks.length > 30) {
            doc.setFontSize(9);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(128, 128, 128); // Gray color for note
            doc.text('Showing top 30 risks. Refine in filters for more detail.', 27, yPosition);
        }

        // Case Studies Section with box layout
        addFooter(doc);
        doc.addPage();
        currentPage++;
        yPosition = 30;
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
            sections: [
                {
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
                                            relative: "page",
                                            align: "center",
                                        },
                                        verticalPosition: {
                                            relative: "page",
                                            offset: 0,
                                        },
                                        allowOverlap: true,
                                        behindDocument: true,
                                        zIndex: -1,
                                    },
                                    type: "png",
                                }),
                            ],
                            spacing: { before: 0, after: 0 },
                        }),

                        // Header text overlaying the image - nursing home name
                        new Paragraph({
                            children: [
                                // Split nursing home name into words and add breaks for long words
                                ...nursingHomeName
                                    .split(" ")
                                    .map((word, i, arr) => [
                                        new TextRun({
                                            text: word,
                                            size: 40,
                                            bold: true,
                                            color: "FFFFFF",
                                        }),
                                        // Add line break if word is too long
                                        word.length > 25
                                            ? new TextRun({ break: 1 })
                                            : new TextRun({
                                                text: " ",
                                                size: 40,
                                                color: "FFFFFF",
                                            }),
                                    ])
                                    .flat(),
                            ],
                            // alignment: AlignmentType.CENTER,
                            indent: {
                                left: 6000,
                                right: 1000,
                            },
                            spacing: { before: 1800, after: 100 },
                        }),

                        // Year text below the line
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: monthYear,
                                    size: 32,
                                    color: "FFFFFF",
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
                            heading: HeadingLevel.HEADING_1,
                            indent: {
                                left: 500,
                                right: 500,
                            },
                            spacing: { before: 2500, after: 200 },
                            children: [
                                new TextRun({
                                    text: "Patient Snapshot Overview: 30-Day Readmissions",
                                    color: hexToDocxColor(COLORS.TITLE), // hex code without '#'
                                    bold: true, // optional
                                }),
                            ],
                        }),
                        ...(readmissionsChartData
                            ? createChartContainer(readmissionsChartData)
                            : []),

                        // Interventions Section
                        new Paragraph({
                            text: "Types of Interventions Delivered",
                            heading: HeadingLevel.HEADING_1,
                            indent: {
                                left: 500,
                                right: 500,
                            },
                            spacing: { before: 400, after: 400 },
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
                                            color: COLORS.SUB_TITLE.replace("#", ""),
                                        }),
                                    ],
                                    indent: {
                                        left: 500,
                                        right: 500,
                                    },
                                    spacing: { before: 200, after: 250 },
                                }),
                                ...items.map(
                                    (item) =>
                                        new Paragraph({
                                            children: [
                                                new TextRun({ text: "•   ", size: 22 }),
                                                new TextRun({
                                                    text: item,
                                                    size: 22,
                                                    color: COLORS.BULLET_TEXT.replace("#", ""),
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
                        ...(touchpointsChartData
                            ? createChartContainer(touchpointsChartData)
                            : []),

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
                        ...(clinicalRisksChartData
                            ? createChartContainer(clinicalRisksChartData)
                            : []),

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
                            .filter(
                                (outcome, index, self) => self.indexOf(outcome) === index
                            )
                            .map(
                                (outcome) =>
                                    new Paragraph({
                                        children: [
                                            new TextRun({ text: "•   ", size: 22 }),
                                            new TextRun({
                                                text: outcome,
                                                size: 22,
                                                color: COLORS.BULLET_TEXT.replace("#", ""),
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
                                                color: COLORS.BULLET_TEXT.replace("#", ""),
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
                        ...(caseStudies.flatMap((s) => s.clinical_risks || []).length >
                            30
                            ? [
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
                            ]
                            : []),

                        // Case Studies Section
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: "Case Study Highlights",
                                    size: 32,
                                    bold: true,
                                    color: hexToDocxColor(COLORS.TITLE),
                                }),
                            ],
                            heading: HeadingLevel.HEADING_1,
                            indent: { left: 500, right: 500 },
                            spacing: { before: 400, after: 400 },
                        }),
                        ...caseStudies.map((study, index) =>
                            createCaseStudyCard(
                                study,
                                index % 2 === 0 ? COLORS.CARD1 : COLORS.CARD2
                            )
                        ).flat(),
                    ],
                },
            ],
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
                size: 10000,
                type: WidthType.DXA,
            },
            layout: TableLayoutType.AUTOFIT,
            columnWidths: [9500],
            indent: {
                size: 500,
                type: WidthType.DXA,
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: {
                                top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                                bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                                left: { style: BorderStyle.SINGLE, size: 16, color: hexToDocxColor(COLORS.SUB_TITLE) },
                                right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                            },
                            shading: { fill: "FFFFFF" },
                            margins: {
                                top: 20,
                                bottom: 50,
                                left: 500,
                                right: 0,
                            },
                            verticalAlign: VerticalAlign.TOP,
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
                                    spacing: { before: 120, after: 240 },
                                    alignment: AlignmentType.LEFT,
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
                                    spacing: { before: 120, after: 120, line: 360 },
                                    alignment: AlignmentType.LEFT,
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
    const borderWidth = 0.7;
    const separatorWidth = 0.2;
    const textStartX = boxLeftMargin + boxPadding + borderWidth + 5;

    caseStudies.forEach((study, index) => {
        console.log("Case Study ", study)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);

        const allLines = doc.splitTextToSize(
            `${study.hospital_discharge_summary_text}\n\n${study.highlight_text}`,
            boxWidth - (boxPadding * 2 + borderWidth + 10)
        );
        const lineHeight = 4.3;
        const headingHeight = 12;
        // const boxHeaderHeight = headingHeight + boxPadding + 10;
        const boxHeaderHeight = headingHeight + boxPadding;
        const textHeight = allLines.length * lineHeight;
        const fullBoxHeight = Math.max(35, textHeight + boxPadding);

        const maxBoxBottom = pageHeight - 30;
        const spaceNeededForHeader = boxHeaderHeight + lineHeight * 2;

        if (yPosition + spaceNeededForHeader > maxBoxBottom) {
            addFooter(doc);
            doc.addPage();
            yPosition = 10;
            doc.setTextColor(COLORS.TITLE);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            yPosition += 12;
        }

        let splitIndex = allLines.length;
        let textOnFirstPage = allLines;
        let textOnNextPage = [];

        if (yPosition + fullBoxHeight > maxBoxBottom) {
            const maxLinesFirstPage = Math.floor((maxBoxBottom - yPosition - boxHeaderHeight) / lineHeight);
            splitIndex = Math.max(0, maxLinesFirstPage);
            textOnFirstPage = allLines.slice(0, splitIndex);
            textOnNextPage = allLines.slice(splitIndex);
        }

        const drawCaseBox = (lines: any, topY: any, isContinued = false) => {
            const boxHeight = Math.max(35, lines.length * lineHeight + boxHeaderHeight);
            doc.setFillColor(255, 255, 255);
            doc.rect(boxLeftMargin, topY, boxWidth, boxHeight, 'F');
            const bgColor = hexToRgb("#1A85FF");
            doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
            doc.rect(boxLeftMargin, topY, borderWidth, boxHeight, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.setTextColor(COLORS.PATIENT_NAME);
            if (!isContinued) {
                doc.text(study.patient_name || 'Unknown Patient', textStartX, topY + boxPadding + 0.1);
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(11);
            doc.setTextColor(85, 85, 85);
            doc.text(lines, textStartX, topY + boxPadding + 10);

            return boxHeight;
        };

        const firstBoxHeight = drawCaseBox(textOnFirstPage, yPosition, false);
        yPosition += firstBoxHeight + 6;

        if (textOnNextPage.length > 0) {
            addFooter(doc);
            doc.addPage();
            yPosition = 10;
            doc.setTextColor(COLORS.TITLE);
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            yPosition += 12;

            const continuedHeight = drawCaseBox(textOnNextPage, yPosition, true);
            yPosition += continuedHeight + 6;
        }

        if (index < caseStudies.length - 1) {
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(separatorWidth);
            doc.line(
                boxLeftMargin,
                yPosition + (fullBoxHeight ?? firstBoxHeight),
                boxLeftMargin + boxWidth,
                yPosition + (fullBoxHeight ?? firstBoxHeight)
            );
        }

        const nextStudy = caseStudies[index + 1];
        if (nextStudy) {
            const nextLines = doc.splitTextToSize(
                nextStudy.highlight_text,
                boxWidth - (boxPadding * 2 + borderWidth + 10)
            );
            const nextTextHeight = nextLines.length * lineHeight;
            const nextBoxHeight = Math.max(35, nextTextHeight + boxPadding + boxHeaderHeight);
            if (yPosition + nextBoxHeight > pageHeight - 30) {
                addFooter(doc);
            }
        }
    });

    return yPosition + 15;
};


const renderChart = async (doc: jsPDF, chartRef: HTMLDivElement | null, yPosition: number, errorMessage: string): Promise<{ newYPosition: number, error?: Error }> => {
    if (!chartRef) {
        return { newYPosition: yPosition };
    }

    try {
        const width = Math.max(chartRef.clientWidth || 600, 600);
        const height = Math.max(chartRef.clientHeight || 500, 0);
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
        clone.style.objectFit = 'contain'
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

const convertChartToImage = async (chartRef: HTMLDivElement | null): Promise<{ data: ArrayBuffer; aspectRatio: number } | undefined> => {
    if (!chartRef) return undefined;

    try {
        // Get the computed styles to include padding and margins
        const computedStyle = window.getComputedStyle(chartRef);
        const rect = chartRef.getBoundingClientRect();

        // Add padding and margins to dimensions
        const fullWidth = rect.width +
            parseFloat(computedStyle.paddingLeft) +
            parseFloat(computedStyle.paddingRight) +
            parseFloat(computedStyle.marginLeft) +
            parseFloat(computedStyle.marginRight);

        const fullHeight = rect.height +
            parseFloat(computedStyle.paddingTop) +
            parseFloat(computedStyle.paddingBottom) +
            parseFloat(computedStyle.marginTop) +
            parseFloat(computedStyle.marginBottom);

        // Ensure minimum dimensions
        const width = Math.max(fullWidth, 600);
        const height = Math.max(fullHeight, 500);
        const aspectRatio = width / height;

        // Create a wrapper with padding to ensure no content is cut
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            width: `${width}px`,
            height: `${height}px`,
            padding: '0',
            display: 'flex',
            justifyContent: 'start',
            alignItems: 'start',
            backgroundColor: '#fff',
            position: 'fixed',
            top: '-9999px',
            left: '-9999px',
            zIndex: '-1',
            overflow: 'hidden',
        });

        // Clone and ensure the chart takes full size
        const clone = chartRef.cloneNode(true) as HTMLElement;
        Object.assign(clone.style, {
            width: '100%',
            height: '50%',
            margin: '0',
            padding: '0',
        });

        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);

        // Wait a bit for chart to render fully
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(wrapper, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 10000,
            width: width + 40, // Add padding to capture
            height: height + 40,
            windowWidth: width + 40,
            windowHeight: height + 40
        });

        document.body.removeChild(wrapper);

        const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0);
        });

        return {
            data: await blob.arrayBuffer(),
            aspectRatio
        };
    } catch (error) {
        console.error('Error converting chart to image:', error);
        return undefined;
    }
};

const createChartContainer = (chartData: { data: ArrayBuffer; aspectRatio: number }) => {
    // Use a wider base width for better visibility
    const baseWidth = 700;  // Increased from 600 to 700
    // Calculate height maintaining aspect ratio with additional padding
    const calculatedHeight = (baseWidth / chartData.aspectRatio) + 40; // Add padding

    // Add maximum and minimum heights to prevent extremes
    const height = Math.min(Math.max(calculatedHeight, 350), 600); // Adjusted min/max heights

    return [
        new Paragraph({
            text: "",
            spacing: { before: 400, after: 0 },  // Increased from 300 to 400
        }),
        new Paragraph({
            children: [
                new ImageRun({
                    data: chartData.data,
                    transformation: {
                        width: baseWidth,
                        height: height,
                    },
                    type: 'png',
                }),
            ],
            spacing: { before: 0, after: 0 },
            alignment: AlignmentType.CENTER,
        }),
        new Paragraph({
            text: "",
            spacing: { before: 0, after: 400 },
            border: {
                top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                left: { style: BorderStyle.SINGLE, size: 8, color: "FFFFFF" },
                right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
            },
        }),
    ];
};
