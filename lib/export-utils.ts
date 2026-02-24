import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType, VerticalAlign, TableLayoutType, ShadingType, PageOrientation, Spacing, HeightRule } from 'docx';
import html2canvas from 'html2canvas';
import card1 from "../public/card1.png"
import card2 from "../public/card2.png"
import card3 from "../public/card3.png"
import { shuffleArray } from "./utils"
const COLORS = {
    TEXT: '07226c',
    PAGE_NUMBER: '#11b3dc',
    HEADER_BORDER: "e6edf5",
    BODY_BORDER: "eef4f9",
    LIGHT_GRAY: "f5f5f5",
    TITLE: '#1e3578',
    SUB_TITLE: '#3b82f6',
    BULLET_TEXT: '#6b789a',
    PATIENT_NAME: '#858387',
    PATIENT_DETAILS: '#bab4bf',
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

interface CaseStudy {
    id: string;
    patient_id: string;
    hospital_discharge_summary_text: string;
    facility_summary_text: string;
    engagement_summary_text: string
    highlight_text: string;
    created_at: string;
    patient_name?: string;
    interventions?: string[];
    outcomes?: string[];
    clinical_risks?: string[];
    detailed_interventions?: { intervention: string; source_quote: string; source_file_id: string }[];
    detailed_outcomes?: { outcome: string; source_quote: string; source_file_id: string }[]
}

interface ExportPDFOptions {
    nursingHomeName: string;
    monthYear: string;
    caseStudies: CaseStudy[];
    caseStudyHighlights?: CaseStudy[];
    interventionStudies?: CaseStudy[];
    logoPath?: string;
    patientMetrics?: any;
    categorizedInterventions: Record<string, string[]>;
    returnBlob?: boolean;
    expandedPatientId?: any;
    chartRef?: HTMLDivElement | null; // Deprecated - kept for backward compatibility
    readmissionsChartRef?: HTMLDivElement | null;
    touchpointsChartRef?: HTMLDivElement | null;
    clinicalRisksChartRef?: HTMLDivElement | null;
    interventionCounts: { name: string; count: number }[];
    totalInterventions: number;
    clinicalRisks: { risk: string; count: number }[];
    readmittedPatients?: Array<{
        name: string;
        hospitalDischargeDate: string;
        snfDischargeDate: string;
        hospitalReadmitDate: string;
        hospitalName: string;
        readmissionReason: string;
    }>;
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

// Allow runtime toggling of PDF watermark via NEXT_PUBLIC_ENABLE_PDF_WATERMARK
const ENABLE_PDF_WATERMARK = (process.env.NEXT_PUBLIC_ENABLE_PDF_WATERMARK ?? "true").toLowerCase() !== "false";

// Stamp a diagonal, tiled watermark on the active PDF page
const addPdfWatermark = (pdf: jsPDF, text: string | string[]) => {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const { fontName, fontStyle } = pdf.getFont();
    const previousFontSize = pdf.getFontSize();
    const watermarkFontSize = Math.min(pageWidth, pageHeight) / 12;
    const normalizedText = Array.isArray(text) ? text.join(" ") : text;
    const textWidth = pdf.getTextWidth(normalizedText);
    const tileSpacingX = Math.max(textWidth + 20, 80);
    const tileSpacingY = Math.max(watermarkFontSize * 3, 80);

    const hasGStateSupport = typeof (pdf as any).setGState === "function" && typeof (pdf as any).GState === "function";
    let resetGState: (() => void) | null = null;

    if (hasGStateSupport) {
        const watermarkGState = (pdf as any).GState({ opacity: 0.15 });
        (pdf as any).setGState(watermarkGState);
        resetGState = () => {
            (pdf as any).setGState((pdf as any).GState({ opacity: 1 }));
        };
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(watermarkFontSize);
    pdf.setTextColor(130, 130, 130);

    let row = 0;
    for (let y = -pageHeight; y < pageHeight * 2; y += tileSpacingY) {
        const rowOffset = (row % 2 === 0 ? 0 : tileSpacingX / 2);
        for (let x = -pageWidth; x < pageWidth * 2; x += tileSpacingX) {
            pdf.text(text, x + rowOffset, y, {
                angle: 45,
            });
        }
        row += 1;
    }

    if (resetGState) {
        resetGState();
    }

    pdf.setFont(fontName, fontStyle);
    pdf.setFontSize(previousFontSize);
    pdf.setTextColor(0, 0, 0);
};

export interface PatientMetrics {
    facilityName: string
    executiveSummary: string
    closingStatement: string
    publicLogoLink: string
    nationalReadmissionsBenchmark: number

    // Rolling (3-month) metrics
    rollingPuzzlePatients: number,
    rollingPuzzleReadmissions: number,
    rollingBambooReadmissions: number,
    totalReadmissions3mo: number,
    rollingRate: number,
}

export const exportToPDF = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    caseStudyHighlights,
    interventionStudies,
    patientMetrics,
    returnBlob = false,
    expandedPatientId,
    interventionCounts,
    totalInterventions,
    clinicalRisks,
    readmittedPatients = []
}: ExportPDFOptions): Promise<void | Blob> => {


    const highlightCaseStudies =
        caseStudyHighlights && caseStudyHighlights.length > 0 ? caseStudyHighlights : caseStudies;
    const interventionCaseStudies =
        interventionStudies && interventionStudies.length > 0 ? interventionStudies : caseStudies;

    const expandedStory = highlightCaseStudies.find(story => story.patient_id === expandedPatientId);

    const logoUrl = patientMetrics?.publicLogoLink;

    let interventionTableRowsHTML = '';

    interventionCounts.forEach((item, index) => {
        const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';
        interventionTableRowsHTML += `
    <tr class="avoid-page-break">
      <td  style="padding:14px; border:1px solid #eef4f9; ${background}">${item.name}</td>
      <td  style="text-align:center; padding:14px; border:1px solid #eef4f9; ${background}">${item.count}</td>
    </tr>
  `;
    });

    // 🔑 Filter out any case study with no engagement_summary_text
    const outcomeFilteredCaseStudies = interventionCaseStudies.filter(
        story => story.engagement_summary_text && story.engagement_summary_text.trim().length > 0
    );

    let keyOutcomesHTML = outcomeFilteredCaseStudies.map((study) => {
        const [first, last] = (study.patient_name || "").split(" ");
        const shortName = first && last ? `${first[0]}. ${last}` : (study.patient_name || "Unknown");

        const interventionsHTML = shuffleArray(study.detailed_interventions || [])
            .map(item => `
            <div class="avoid-page-break" style="
                display: flex;
                align-items: flex-start;
                margin-bottom: 4px;
            ">
                <span style="display:inline-block; font-size:14px; margin-right:6px;">•</span>
                <span style="font-size:14px; color:#07226c; line-height:1.4;">${item.intervention}</span>
            </div>
        `).join("");

        const outcomesHTML = (study.detailed_outcomes || [])
            .map(item => `
            <div class="avoid-page-break" style="
                display: flex; 
                align-items: flex-start; 
                margin-bottom: 4px;
            ">
                <span style="display:inline-block; font-size:14px; margin-right:6px;">•</span>
                <span style="font-size:14px; color:#07226c; line-height:1.4;">${item.outcome}</span>
            </div>
        `).join("");

        return `
        <div style="margin-bottom: 24px;">
            <p class="avoid-page-break" style="font-size:14px; font-weight:bold; color:#07226c; margin-bottom:6px;">
                ${shortName}:
            </p>

            ${interventionsHTML ? `
                <p class="avoid-page-break" style="font-size:14px; font-weight:500; color:#07226c; margin-bottom:4px;">
                    Interventions:
                </p>
                ${interventionsHTML}
            ` : ""}

            ${outcomesHTML ? `
                <p class="avoid-page-break" style="font-size:14px; font-weight:500; color:#07226c; margin-top:10px; margin-bottom:4px;">
                    Outcomes:
                </p>
                ${outcomesHTML}
            ` : ""}
        </div>
    `;
    }).join("");

    let tableRowsHTML = '';

    clinicalRisks.forEach((item, index) => {
        const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';

        tableRowsHTML += `
    <tr  class="avoid-page-break">
      <td style="padding:14px; border:1px solid #eef4f9;${background}">${item.risk}</td>
      <td  style="text-align:center; padding:14px; border:1px solid #eef4f9;${background}">${item.count}</td>
    </tr>
  `;
    });


    let cardsHTML = `
    <div style="
    display: flex;
    flex-wrap: wrap;
    gap: 16px 12px;
    color: #07226c;
    ">
    `;

    let filteredCaseStudies = highlightCaseStudies.filter(item => item.patient_id !== expandedPatientId);

    // 🔑 Filter out any case study with no engagement_summary_text
    filteredCaseStudies = filteredCaseStudies.filter(
        story => story.engagement_summary_text && story.engagement_summary_text.trim().length > 0
    );

    filteredCaseStudies.forEach(item => {
        const [first, last] = item.patient_name ? item.patient_name.split(" ") : [];

        cardsHTML += `
  <div  style="
    flex: 1 1 calc((100% - 24px) / 3);
    min-width: 200px;
    padding: 10px;
    color: #07226c;
    border: 1px solid #d7e3f4;
    border-radius: 8px;
    box-sizing: border-box;
    margin-bottom: 16px;
  " >
    <span class="avoid-page-break" style="font-weight:bold; color:#002d74; margin-right:6px;">
      ${first ? first[0] + "." : ""}${last ? last : ""}:
    </span>
    <span class="avoid-page-break" style="font-size:13px; color: #07226c;
">
      ${item.engagement_summary_text}
    </span>
  </div>
  `;
    });

    cardsHTML += `</div>`;


    let expandedStoryHTML = '';

    if (expandedStory && expandedStory.patient_name && expandedStory.engagement_summary_text) {
        const [first, last] = expandedStory.patient_name.split(" ");
        const initials = `${first ? first[0] + "." : ""}${last ? last : ""}`;

        expandedStoryHTML = `
  <div  style="
    flex: 1 1 calc((100% - 24px) / 3);
    min-width: 200px;
    padding: 10px;
    color: #07226c;
    border: 1px solid #d7e3f4;
    border-radius: 8px;
    box-sizing: border-box;
    margin-bottom: 16px;
  " >
    <span class="avoid-page-break" style="font-weight:bold; color:#002d74; margin-right:6px;">
      <h2  style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">Expanded Resident Success Story: ${initials}</h2>
    </span>
    <span class="avoid-page-break" style="font-size:13px; color: #07226c;
">
      ${expandedStory.hospital_discharge_summary_text}
        ${expandedStory.facility_summary_text}
      ${expandedStory.engagement_summary_text}

    </span>
  </div>
`;
    }


    const htmlContentVal = `
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Puzzle SNF Report for ${nursingHomeName} - ${monthYear}</title>
</head>

<body style="margin:0 20px; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif;">
    <!-- Page wrapper sized to mimic print width (1200px wide for clarity) -->
    <div
        style="width: 1200px; margin: 0 auto; background: #ffffff; padding: 40px; box-sizing: border-box; border-radius: 4px;">

        <!-- Header -->
        <div style="position: relative; width: 100%; ">
            <h1 style="margin: 0; font-size: 40px; color: #07226c; font-weight: 700; line-height: 1;">Puzzle SNF Report
                for ${nursingHomeName}</h1>
            <p style="margin: 8px 0 0 0; font-size: 18px; color: #6b789a; font-weight: 500;">${monthYear}</p>
        </div>

        <div style="margin-top: 50px; display: flex; align-items: center; width: 100%;">

            <div style="width: 60%; padding-right: 20px; box-sizing: border-box;">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">Executive Summary
                </h2>
                <p class="avoid-page-break" style="margin: 0; font-size: 15px; color: #07226c; line-height: 1.6;">
                    ${patientMetrics?.executiveSummary}
                </p>
            </div>

            <div style="width: 40%; display: flex; align-items: center; justify-content: center;">
                <img src="${logoUrl}" alt="Logo" style="max-width: 100%; max-height: 90px; object-fit: contain;" />
            </div>

        </div>

        <!-- Section title -->
        <div style="margin-top: 32px;">
            <h2 style="font-size: 26px; color: #07226c; font-weight: 800; margin: 0 0 14px 0;margin-bottom: 16px;">Patient Snapshot
                Overview: 30-Day Readmissions</h2>

            <!-- Table -->
            <div style="width: 100%;margin-top:16px">
                <table style="width:100%; border-collapse: collapse; font-size:14px;color: #07226c;">
                    <thead>
                        <tr>
                        <th style="text-align:left; padding:14px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Metric</th>
                        <th
                            style="width:140px; text-align:center; padding:14px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Count</th>
                        <th
                            style="width:160px; text-align:center; padding:14px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                        <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">Total Puzzle Continuity Care Patients
                            Tracked</td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">
                            ${patientMetrics?.rollingPuzzlePatients}</td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">-</td>
                        </tr>
                        <tr>
                        <td style="padding:14px; border:1px solid #eef4f9;">30-Day Readmissions (Puzzle Patients)
                        </td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;">
                            ${patientMetrics?.rollingBambooReadmissions}</td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;">
                            ${patientMetrics?.rollingRate.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size:14px; margin:12px 0 0 0;color: #07226c;">Note: Readmissions reflect only patients
                    supported by Puzzle Continuity Care.</p>
            </div>
        </div>

        <!-- 30-Day Re-Admitted Patients Table -->
        ${readmittedPatients && readmittedPatients.length > 0 ? `
        <div style="margin-top: 32px;">
            <h2 style="font-size: 26px; color: #07226c; font-weight: 800; margin: 0 0 14px 0;margin-bottom: 16px;">
                30-Day Re-Admitted Patients
            </h2>

            <div style="width: 100%;margin-top:16px">
                <table style="width:100%; border-collapse: collapse; font-size:14px;color: #07226c;">
                    <thead>
                        <tr>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Patient Name
                            </th>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Hospital Discharge Date
                            </th>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                SNF Discharge Date
                            </th>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Hospital Readmission Date
                            </th>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Hospital Name
                            </th>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Readmission Reason
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${readmittedPatients.map((patient, index) => {
                            const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';
                            return `
                            <tr class="avoid-page-break">
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.name}
                                </td>
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.hospitalDischargeDate}
                                </td>
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.snfDischargeDate}
                                </td>
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.hospitalReadmitDate}
                                </td>
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.hospitalName}
                                </td>
                                <td style="padding:14px; border:1px solid #eef4f9; ${background}">
                                    ${patient.readmissionReason}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        ` : ''}

        <div style="margin-top: 32px;">
            <div style="height: 18px;"></div>

            <div style="display: flex; gap: 20px; flex-wrap: wrap;">

                <div
                    style="flex: 1; min-width: 300px; position: relative; padding:24px; border: 1px solid #A0E4F8; border-top: 8px solid #7fdbff; border-radius: 10px;">
                    <div
                        style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; background-color: #7fd9f1; border-radius: 50%; z-index: 2;">
                    </div>
                    <div style="text-align:center; color:#07226c; font-size:20px; font-weight:700; margin-bottom: 16px;">
                        Types of Puzzle Interventions Delivered
                    </div>
                   <table style="width:100%; border-collapse: collapse; font-size:14px; color:#07226c;">
                        <thead>
                            <tr>
                            <th style="text-align:left; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Intervention Type
                            </th>
                            <th style="width:140px; text-align:center; padding:14px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Count
                            </th>
                            </tr>
                        </thead>
                        <tbody>
                            ${interventionTableRowsHTML}
                        </tbody>
                    </table>
                </div>
                <div
                    style="flex: 1; min-width: 300px; position: relative; padding:24px; border: 1px solid #A0E4F8; border-top: 8px solid #7fdbff; border-radius: 10px;">
                    <div
                        style="position: absolute; top: -25px; left: 50%; transform: translateX(-50%); width: 40px; height: 40px; background-color: #7fd9f1; border-radius: 50%; z-index: 2;">
                    </div>
                    <div style="text-align:center; color:#07226c; font-size:20px; font-weight:700; margin-bottom: 16px;">
                        Top Clinical Risks Identified at Discharge
                    </div>
                    <table style="width:100%; border-collapse: collapse; font-size:14px; color:#07226c;">
                            <thead>
                                <tr>
                                    <th
                                        style="text-align:left; padding:14px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                        Clinical Risk</th>
                                    <th
                                        style="width:140px; text-align:center; padding:14px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                        Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHTML}
                            </tbody>
                        </table>
                </div>

            </div>
    
            <div  class="avoid-page-break">
            <div style="margin-top: 36px;">
                <h2 style="font-size: 26px; color: #07226c; font-weight: 800; margin: 0 0 14px 0;">Key Interventions and
                 Outcomes</h2>
             </div>
                ${keyOutcomesHTML}
            </div>
            <div style="margin-top: 36px;">
             <div  class="avoid-page-break">
             <h2 style="margin: 0 0 0 0; font-size: 28px;margin-bottom:16px; color: #07226c; font-weight: 700;">
                 Case Study Highlights: Individual Patient Successes
             </h2>
             </div>
                ${cardsHTML}
            </div>
            ${expandedStoryHTML}
            <div class="avoid-page-break" style="margin-top: 36px;">
                <h2  style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">National Benchmark
                    Comparison</h2>
                <div>
                    <table style="width:100%; border-collapse: collapse; font-size:14px;   color: #07226c;">
                        <thead>
                            <tr class="avoid-page-break">
                                <th 
                                    style="width:33.33%; text-align:left; padding:14px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                    Metric
                                </th>
                                <th
                                    style="width:33.33%; text-align:left; padding:14px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                    ${nursingHomeName}
                                </th>
                                <th
                                    style="width:33.33%; text-align:left; padding:14px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                    National Benchmark*
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr class="avoid-page-break">
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">30-Day Readmission Rate (Puzzle
                                    Patients)</td>
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">
                                    ${patientMetrics?.rollingRate.toFixed(1)}%</td>
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">
                                    ${patientMetrics?.nationalReadmissionsBenchmark}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p class="avoid-page-break" style="font-size:13px; margin:12px 0 0 0; color: #07226c;">Source: CMS SNF QRP 2024 National Averages.</p>
            </div>


            <div style="margin-top: 36px;" class="avoid-page-break">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;margin-bottom:16px;">Ongoing Focus Areas
                </h2>


                <div id="card-wrapper" 
                    style="display: flex; gap: 24px; justify-content: start; background: white;margin-top: 24px;">
                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 80px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="80" viewBox="0 0 366 80" preserveAspectRatio="none"
                                style="position: absolute; top:0; left:0; z-index: 0;">
                                <polygon points="0,0 329,0 366,40 329,80 0,80 37,40" fill="#D3F1FC" />
                            </svg>
                            <img src="https://img.icons8.com/ios-filled/24/07226c/hospital-room.png"
                                style="width: 24px; height: 24px; position: relative; z-index: 1;" />
                        </div>
                        <div
                            style="font-size: 20px; font-weight: bold; color: #07226c; margin-top: 12px; margin-left:30px; text-align: left;">
                            Reduce Readmissions
                        </div>
                        <div
                            style="font-size: 16px; color: #07226c; margin-top: 6px; line-height: 1.4;text-align: left;margin-left:30px;">
                            Through proactive escalation and<br />earlier detection.
                        </div>
                    </div>

                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 80px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="80" viewBox="0 0 366 80" preserveAspectRatio="none"
                                style="position: absolute; top:0; left:0; z-index: 0;">
                                <polygon points="0,0 329,0 366,40 329,80 0,80 37,40" fill="#D3F1FC" />
                            </svg>
                           <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#07226c"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                style="position: relative; z-index: 1;"
                                xmlns="http://www.w3.org/2000/svg"
                            >
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                        </div>
                        <div
                            style="font-size: 20px; font-weight: bold; color: #07226c; margin-top: 12px;text-align: left;margin-left:30px;">
                            Strengthen Fall Prevention
                        </div>
                        <div
                            style="font-size: 16px; color: #07226c; margin-top: 6px; line-height: 1.4;text-align: left;margin-left:30px;">
                            With enhanced assessments and<br />environment safety reviews.
                        </div>
                    </div>
                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 80px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="80" viewBox="0 0 366 80" preserveAspectRatio="none"
                                style="position: absolute; top:0; left:0; z-index: 0;">
                                <polygon points="0,0 329,0 366,40 329,80 0,80 37,40" fill="#D3F1FC" />
                            </svg>
                            <svg
                                width="24"
                                height="24"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#07226c"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                xmlns="http://www.w3.org/2000/svg"
                                style="position: relative; z-index: 1;"
                                >
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                            </svg>
                        </div>
                        <div
                            style="font-size: 20px;text-align: left;margin-left:30px; font-weight: bold; color: #07226c; margin-top: 12px;">
                            Advance CHF Management
                        </div>
                        <div
                            style="font-size: 16px; text-align: left;margin-left:30px;color: #07226c; margin-top: 6px; line-height: 1.4;">
                            By prioritizing early symptom<br />monitoring and follow-up adherence.
                        </div>
                    </div>
                </div>
            </div>
            <div class="avoid-page-break" style="margin-top: 36px; margin-bottom: 30px">
            </div>
            <div class="avoid-page-break" style="margin-top: 50px; margin-bottom: 30px">
                <h2 style="margin: 0 0 0 0; font-size: 28px; color: #07226c; font-weight: 700;margin-bottom:16px;">Closing Summary</h2>
                <p style="color: #07226c;">${patientMetrics?.closingStatement}</p>
            </div>
        </div>
</body>

</html>
   `;
    console.log("htmlContentVal", htmlContentVal)
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.innerHTML = htmlContentVal;
    document.body.appendChild(container);

    // 2. Render to tall canvas
    const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: container.offsetWidth,
        height: container.scrollHeight,
    });

    const scaleY = canvas.height / container.scrollHeight;
    const rawEls = Array.from(container.querySelectorAll(".avoid-page-break"));
    const groups: { top: number; bottom: number; height: number }[] = [];

    if (rawEls.length > 0) {
        let currentGroup: HTMLElement[] = [rawEls[0] as HTMLElement];

        for (let i = 1; i < rawEls.length; i++) {
            const prev = rawEls[i - 1] as HTMLElement;
            const curr = rawEls[i] as HTMLElement;

            // Check if consecutive in DOM
            if (prev.nextElementSibling === curr) {
                currentGroup.push(curr);
            } else {
                // Finalize previous group
                groups.push(groupToBox(currentGroup, scaleY));
                currentGroup = [curr];
            }
        }

        // Final group
        if (currentGroup.length > 0) {
            groups.push(groupToBox(currentGroup, scaleY));
        }
    }

    // Helper to convert group of elements to bounding box in canvas coords
    function groupToBox(els: HTMLElement[], scaleY: number) {
        const top = els[0].offsetTop * scaleY;
        const last = els[els.length - 1];
        const bottom = (last.offsetTop + last.offsetHeight) * scaleY;
        return {
            top,
            bottom,
            height: bottom - top,
        };
    }

    // Safe to remove container
    document.body.removeChild(container);

    // 4. Setup PDF
    const pdf = new jsPDF("p", "mm", "a4");
    const watermarkContent = "BETA - For Puzzle Internal Use Only";
    const pdfMargin = 10;
    const pdfPageWidth = pdf.internal.pageSize.getWidth();
    const pdfPageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pdfPageWidth - pdfMargin * 2;
    const usableHeight = pdfPageHeight - pdfMargin * 2;
    const pageHeightInPixels = (usableHeight * canvas.width) / usableWidth;

    // 5. Slice pages
    let yPosition = 0;
    let remainingHeight = canvas.height;
    let isFirstPage = true;

    while (remainingHeight > 0) {
        if (!isFirstPage) {
            pdf.addPage();
        }

        let potentialSliceEnd = yPosition + pageHeightInPixels;
        let actualSliceEnd = potentialSliceEnd;

        // Adjust slice if a group crosses
        groups.forEach(group => {
            if (group.top < potentialSliceEnd && group.bottom > potentialSliceEnd) {
                if (group.height <= pageHeightInPixels) {
                    // Fits in one page → push group fully to next page
                    if (group.top > yPosition) {
                        actualSliceEnd = Math.min(actualSliceEnd, group.top);

                        // If too close → skip page
                        if (actualSliceEnd <= yPosition + 50) {
                            actualSliceEnd = yPosition;
                        }
                    }
                } else {
                    // Group taller than page → allow breaking
                    actualSliceEnd = potentialSliceEnd;
                }
            }
        });

        let sliceHeight = actualSliceEnd - yPosition;

        if (sliceHeight <= 0) {
            // Skip page
            yPosition = potentialSliceEnd;
            remainingHeight -= pageHeightInPixels;
            isFirstPage = false;
            continue;
        }

        sliceHeight = Math.min(sliceHeight, remainingHeight);

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext("2d");

        if (ctx) {
            ctx.drawImage(
                canvas,
                0,
                yPosition,
                canvas.width,
                sliceHeight,
                0,
                0,
                canvas.width,
                sliceHeight
            );

            const imgData = pageCanvas.toDataURL("image/jpeg", 1);
            const imgHeight = (sliceHeight * usableWidth) / canvas.width;

            pdf.addImage(imgData, "JPEG", pdfMargin, pdfMargin, usableWidth, imgHeight);
        }

        if (ENABLE_PDF_WATERMARK) {
            addPdfWatermark(pdf, watermarkContent);
        }

        yPosition += sliceHeight;
        remainingHeight -= sliceHeight;
        isFirstPage = false;
    }

    // 6. Save or return
    if (returnBlob) {
        return pdf.output("blob");
    } else {
        pdf.save(`${nursingHomeName}-case-studies-${monthYear}.pdf`);
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


const hexToDocxColor = (hex: string): string => {
    return hex.replace('#', '');
};


const createDocumentStyles = () => ({
    paragraphStyles: [
        {
            id: "heading1",
            name: "Heading 1",
            basedOn: "Normal",
            next: "Normal",
            run: {
                size: 50,
                bold: true,
                color: "07226c",
                font: "Arial",
            },
            paragraph: {
                spacing: { after: 240 },
            },
        },
        {
            id: "heading2",
            name: "Heading 2",
            basedOn: "Normal",
            next: "Normal",
            run: {
                bold: true,
                size: 20 * 2,
                color: "07226C",
                font: "Arial",
            },
            paragraph: {
                spacing: { before: 240, after: 120 },
            },
        },
        {
            id: "normalText",
            name: "Normal Text",
            run: {
                color: "07226c",
                font: "Arial",
                size: 20
            },
            paragraph: {
                spacing: { line: 360 }, // 1.6 line height (240 = single)
                indent: { left: 0 }
            }
        },
        {
            id: "cardTitle",
            name: "Card Title",
            basedOn: "Normal",
            next: "Normal",
            run: {
                color: "07226c",
                bold: true,
                size: 18 * 2,
                font: "Arial",
            },
            paragraph: {
                spacing: { after: 160 },
                alignment: AlignmentType.CENTER
            },
        },
        {
            id: "tableHeader",
            name: "Table Header",
            basedOn: "Normal",
            next: "Normal",
            run: {
                color: "07226c",
                bold: true,
                size: 10 * 2,
                font: "Arial",
            },
            paragraph: {
                spacing: { after: 80, line: 360 }
            },
        },
        {
            id: "tableText",
            name: "Table Text",
            basedOn: "Normal",
            next: "Normal",
            run: {
                color: "07226c",
                size: 10 * 2,
                font: "Arial",
            },
            paragraph: {
                spacing: { after: 60, line: 360 }
            },
        },
    ],
    tableStyles: [
        {
            id: "cardCell",
            name: "Card Cell",
            borders: {
                top: { style: BorderStyle.SINGLE, size: 3, color: "d7e3f4" },
                bottom: { style: BorderStyle.SINGLE, size: 3, color: "d7e3f4" },
                left: { style: BorderStyle.SINGLE, size: 3, color: "d7e3f4" },
                right: { style: BorderStyle.SINGLE, size: 3, color: "d7e3f4" },
            },
            Spacing: 2,
            shading: { fill: "FFFFFF" },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
        }
    ]
});

const createStyledTable = (data: ReportData) => {
    return new Table({
        width: {
            size: 100,
            type: WidthType.PERCENTAGE,
        },
        columnWidths: [7000, 1300, 1700],
        rows: [
            new TableRow({
                children: [
                    createCell({
                        text: "Metric",
                        isHeader: true,
                        bold: true,
                        borderColor: headerBorderColor,
                        bgColor: undefined,
                        isCenter: false,
                    }),
                    createCell({
                        text: "Count",
                        isHeader: true,
                        bold: true,
                        borderColor: headerBorderColor,
                        isCenter: true,
                    }),
                    createCell({
                        text: "Percentage",
                        isHeader: true,
                        bold: true,
                        borderColor: headerBorderColor,
                        isCenter: true,
                    }),
                ],
            }),

            new TableRow({
                children: [
                    createCell({
                        text: "Total Puzzle Continuity Care Patients Tracked",
                        borderColor: bodyBorderColor,
                        bgColor: lightGrayBg,
                        isCenter: false,
                    }),
                    createCell({
                        text: data.patientMetrics?.rollingPuzzlePatients,
                        borderColor: bodyBorderColor,
                        bgColor: lightGrayBg,
                        isCenter: true,
                    }),
                    createCell({
                        text: "-",
                        borderColor: bodyBorderColor,
                        bgColor: lightGrayBg,
                        isCenter: true,
                    }),
                ],
            }),

            new TableRow({
                children: [
                    createCell({
                        text: "30-Day Readmissions (Puzzle Patients)",
                        borderColor: bodyBorderColor,
                        isCenter: false,
                    }),
                    createCell({
                        text: data.patientMetrics?.rollingBambooReadmissions,
                        borderColor: bodyBorderColor,
                        isCenter: true,
                    }),
                    createCell({
                        text: data.patientMetrics?.rollingRate.toFixed(1),
                        borderColor: bodyBorderColor,
                        isCenter: true,
                    }),
                ],
            }),
        ],
    });
};


interface ReportData {
    expandedPatientId: string
    executiveSummary: string
    facilityName: string;
    logoUrl?: string;
    totalPatients: number;
    readmissions: number;
    readmissionRate: string;
    patientMetrics: any;
    interventions: { name: string; count: number }[]
    clinicalRisks: Array<{
        risk: string;
        count: number;
    }>;
    keyInterventions: Array<{
        patientId: string;
        interventions: string[];
        outcomes: string[];
        patientName: string;
    }>;
    caseStudies: CaseStudy[]
    nationalBenchmark: string;
}

async function fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
    });
}




function createDataRows(data: { name?: string; risk?: string; count: number }[], isIntervention: boolean) {
    return data.map((item, idx) =>
        new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            text: isIntervention ? item.name! : item.risk!,
                            style: "tableText"
                        })
                    ],
                    shading: {
                        type: ShadingType.CLEAR,
                        fill: idx % 2 === 0 ? "F5F5F5" : "FFFFFF"
                    },
                    borders: {
                        top: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        bottom: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        left: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        right: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                    },
                    verticalAlign: VerticalAlign.CENTER
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            text: String(item.count),
                            alignment: AlignmentType.CENTER,
                            style: "tableText",
                        }),
                    ],
                    shading: {
                        type: ShadingType.CLEAR,
                        fill: idx % 2 === 0 ? "F5F5F5" : "FFFFFF"
                    },
                    borders: {
                        top: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        bottom: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        left: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                        right: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 2 },
                    },
                    verticalAlign: VerticalAlign.CENTER
                }),
            ],
        })
    );
}

function createCard(title: string, rows: TableRow[]) {
    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows: [
            // Title row
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                text: title,
                                style: "cardTitle",
                                alignment: AlignmentType.CENTER,
                                spacing: { after: 240, before: 200 },
                            }),
                        ],
                        borders: noBorder,
                        columnSpan: 2,
                    }),
                ],
            }),
            // Header row
            new TableRow({
                children: [
                    new TableCell({
                        children: [
                            new Paragraph({
                                text: title.includes("Intervention") ? "Intervention Type" : "Clinical Risk",
                                style: "tableHeader",
                            }),
                        ],
                        borders: {
                            top: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            bottom: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            left: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            right: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                        },
                        verticalAlign: VerticalAlign.CENTER
                    }),
                    new TableCell({
                        children: [
                            new Paragraph({
                                text: "Count",
                                alignment: AlignmentType.CENTER,
                                style: "tableHeader",
                            }),
                        ],
                        borders: {
                            top: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            bottom: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            left: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                            right: { style: BorderStyle.SINGLE, color: "E6EDF5", size: 4 },
                        },
                        verticalAlign: VerticalAlign.CENTER
                    }),
                ],
            }),
            ...rows,
        ],
    });
}
async function loadImage(path: string) {
    const response = await fetch(path);
    return await response.arrayBuffer();
}
const noBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
};
const createCaseStudyCard = (study: CaseStudy | undefined) => {

    return [
        // Spacer paragraph for top margin between cards
        new Paragraph({ spacing: { before: 50 } }),

        new Table({
            width: {
                size: 10000,
                type: WidthType.DXA,
            },
            layout: TableLayoutType.AUTOFIT,
            columnWidths: [9500],
            indent: {
                size: 10,
                type: WidthType.DXA,
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            borders: {
                                top: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                                bottom: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                                left: { style: BorderStyle.SINGLE, size: 10, color: "7fd9f1" },
                                right: { style: BorderStyle.SINGLE, size: 1, color: "FFFFFF" },
                            },
                            shading: { fill: "FFFFFF" },
                            margins: {
                                top: 20,
                                bottom: 50,
                                left: 150,
                                right: 0,
                            },
                            verticalAlign: VerticalAlign.TOP,
                            children: [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: study?.hospital_discharge_summary_text || "",
                                            size: 20,
                                            color: "002d74",
                                            font: "Arial",
                                        }),
                                    ],
                                    spacing: { before: 120, after: 50, line: 360 },
                                    alignment: AlignmentType.LEFT,
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: study?.facility_summary_text || "",
                                            size: 20,
                                            color: "002d74",
                                            font: "Arial",
                                        }),
                                    ],
                                    spacing: { before: 70, after: 50, line: 360 },
                                    alignment: AlignmentType.LEFT,
                                }),
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: study?.engagement_summary_text || "",
                                            size: 20,
                                            color: "002d74",
                                            font: "Arial",
                                        }),
                                    ],
                                    spacing: { before: 70, after: 50, line: 360 },
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


const createBorder = (color: string) => ({
    style: BorderStyle.SINGLE,
    size: 4,
    color: color,
});

const headerBorderColor = "e6edf5";
const bodyBorderColor = "eef4f9";
const textColor = COLORS.TEXT;
const lightGrayBg = "f5f5f5";

const createCell = ({
    text,
    isHeader = false,
    isCenter = false,
    bgColor,
    borderColor,
    bold = false,
}: {
    text: string;
    isHeader?: boolean;
    isCenter?: boolean;
    bgColor?: string;
    borderColor: string;
    bold?: boolean;
}) => {
    return new TableCell({
        shading: bgColor ? { fill: bgColor } : undefined,
        margins: {
            top: 280,
            bottom: 280,
            left: 280,
            right: 280,
        },
        borders: {
            top: createBorder(borderColor),
            bottom: createBorder(borderColor),
            left: createBorder(borderColor),
            right: createBorder(borderColor),
        },
        verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({
                alignment: isCenter ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [
                    new TextRun({
                        text: text.toString(),
                        bold: bold,
                        color: textColor,
                        size: 20,
                        font: "Arial",
                    }),
                ],
                spacing: { before: 0, after: 0 },
            }),
        ],
    });
};

function createCardLayoutTable(data: CaseStudy[], expandedPatientId: string) {
    const filteredCaseStudies = data.filter(
        (study) => study?.patient_id !== expandedPatientId
    );
    if (filteredCaseStudies.length === 0) {
        return new Paragraph({ text: "No case studies available" });
    }

    const itemsPerRow = 3;
    const rows: TableRow[] = [];
    const rowCount = Math.ceil(filteredCaseStudies.length / itemsPerRow);

    for (let r = 0; r < rowCount; r++) {
        const startIndex = r * itemsPerRow;
        const widthPerCard = 33.33;
        const cells: TableCell[] = [];

        for (let c = 0; c < itemsPerRow; c++) {
            const study = filteredCaseStudies[startIndex + c];

            if (study) {
                const nameParts = (study.patient_name || "").split(" ");
                const shortName = nameParts.length >= 2
                    ? `${nameParts[0][0]}.${nameParts[1][0]}.`
                    : study.patient_name || "";

                console.log("shortName", shortName);
                console.log("STUDY ", study);

                cells.push(
                    new TableCell({
                        width: { size: widthPerCard, type: WidthType.PERCENTAGE },
                        margins: {
                            top: 200,
                            bottom: 200,
                            left: 100,
                            right: 100,
                        },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 2, color: "d7e3f4" },
                            bottom: { style: BorderStyle.SINGLE, size: 2, color: "d7e3f4" },
                            left: { style: BorderStyle.SINGLE, size: 2, color: "d7e3f4" },
                            right: { style: BorderStyle.SINGLE, size: 2, color: "d7e3f4" },
                        },
                        verticalAlign: VerticalAlign.TOP,
                        children: [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `(${shortName}):`,
                                        bold: true,
                                        size: 20,
                                        font: "Arial",
                                        color: "002d74",
                                    }),
                                    new TextRun({
                                        text: study.hospital_discharge_summary_text || "",
                                        size: 20,
                                        font: "Arial",
                                        color: "07226c",
                                    }),                                    
                                    new TextRun({
                                        text: study.engagement_summary_text || "",
                                        size: 20,
                                        font: "Arial",
                                        color: "07226c",
                                    }),
                                ],
                            }),
                        ],
                    })
                );
            } else {
                // Empty placeholder cell
                cells.push(
                    new TableCell({
                        width: { size: widthPerCard, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        children: [],
                    })
                );
            }
        }


        rows.push(
            new TableRow({
                children: cells,
                cantSplit: false,
            })
        );

        // Add vertical spacing between rows (fake spacer row)
        if (r < rowCount - 1) {
            rows.push(new TableRow({
                children: [
                    new TableCell({
                        children: [],
                        columnSpan: itemsPerRow,
                        borders: {
                            top: { style: BorderStyle.NONE },
                            bottom: { style: BorderStyle.NONE },
                            left: { style: BorderStyle.NONE },
                            right: { style: BorderStyle.NONE },
                        },
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }),
                ],
                height: {
                    value: 200,
                    rule: HeightRule.ATLEAST,
                },
            }));
        }
    }

    return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: noBorder,
        rows,
    });
}

