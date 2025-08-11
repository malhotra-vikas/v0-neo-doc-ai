import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType, VerticalAlign, TableLayoutType } from 'docx';
import html2canvas from 'html2canvas';


const COLORS = {
    PUZZLE_BLUE: '#28317c',
    PAGE_NUMBER: '#11b3dc',
    TITLE: '#1e3578',
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
}

interface ExportDOCXOptions {
    nursingHomeName: string;
    monthYear: string;
    caseStudies: CaseStudy[];
    patientMetrics?: any;
    logoPath?: string;
    categorizedInterventions: Record<string, string[]>;
    returnBlob?: boolean;
    expandedPatientId?: any;
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

export interface PatientMetrics {
    totalPuzzlePatients: number
    commulative30DayReadmissionCount_fromSNFAdmitDate: number
    commulative30Day_ReadmissionRate: number
    facilityName: string
    executiveSummary: string
    closingStatement: string
    publicLogoLink: string
    nationalReadmissionsBenchmark: number
}

const loadImageFromUrl = async (url: string) => {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.readAsDataURL(blob);
    });
};

export const exportToPDF = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    patientMetrics,
    returnBlob = false,
    expandedPatientId,
    interventionCounts,
    totalInterventions,
    clinicalRisks
}: ExportPDFOptions): Promise<void | Blob> => {


    const expandedStory = caseStudies.find(story => story.patient_id === expandedPatientId);

    const logoUrl = patientMetrics?.publicLogoLink;

  let interventionTableRowsHTML = '';

interventionCounts.forEach((item, index) => {
  const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';
  interventionTableRowsHTML += `
    <tr>
      <td style="padding:14px; border:1px solid #eef4f9; ${background}">${item.name}</td>
      <td style="text-align:center; padding:14px; border:1px solid #eef4f9; ${background}">${item.count}</td>
    </tr>
  `;
});


let keyOutcomesHTML = caseStudies.map((study) => {
    const [first, last] = (study.patient_name || "").split(" ");
    const shortName = first && last ? `${first} ${last[0]}.` : (study.patient_name || "Unknown");

    const interventionsHTML = (study.detailed_interventions || [])
        .map(item => `
            <li style="
                list-style: none;
                font-size: 14px;
                color: #07226c;
                line-height: 1.4;
                display: flex;
                align-items: center;
            ">
                <span style="display:inline-block; font-size:14px; margin-right:6px;">•</span>
                <span>${item.intervention}</span>
            </li>
        `)
        .join("");

    const outcomesHTML = (study.detailed_outcomes || [])
        .map(item => `
            <li style="
                list-style: none;
                font-size: 14px;
                color: #07226c;
                line-height: 1.4;
                display: flex;
                align-items: center;
            ">
                <span style="display:inline-block; font-size:14px; margin-right:6px;">•</span>
                <span>${item.outcome}</span>
            </li>
        `)
        .join("");

    return `
        <div style="margin-bottom: 24px;">
            <p style="font-size: 14px; font-weight:bold; color: #07226c; margin-bottom: 6px;">
                (${shortName}):
            </p>

            ${interventionsHTML ? `
                <p style="font-size: 14px; font-weight: 500; color: #07226c; margin-bottom: 4px;">
                    Interventions:
                </p>
                <ul style="margin: 0; padding-left: 18px;">
                    ${interventionsHTML}
                </ul>
            ` : ""}

            ${outcomesHTML ? `
                <p style="font-size: 14px; font-weight: 500; color: #07226c; margin-top: 10px; margin-bottom: 4px;">
                    Outcomes:
                </p>
                <ul style="margin: 0; padding-left: 18px;">
                    ${outcomesHTML}
                </ul>
            ` : ""}
        </div>
    `;
}).join("");

    let tableRowsHTML = '';

    clinicalRisks.forEach((item, index) => {
  const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';
  
  tableRowsHTML += `
    <tr>
      <td style="padding:14px; border:1px solid #eef4f9;${background}">${item.risk}</td>
      <td style="text-align:center; padding:14px; border:1px solid #eef4f9;${background}">${item.count}</td>
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
const filteredCaseStudies = caseStudies.filter(item => item.patient_id !== expandedPatientId);
filteredCaseStudies.forEach(item => {
    const [first, last] = item.patient_name ? item.patient_name.split(" ") : [];

  cardsHTML += `
    <div style="
    flex: 1 1 calc((100% - 24px) / 3);
    min-width: 200px;
    padding: 10px;
    color: #07226c;
    border: 1px solid #d7e3f4;
    border-radius: 8px;
    box-sizing: border-box;
    margin-bottom: 16px;
  ">
    <span style="font-weight:bold; color:#002d74; margin-right:6px;">
      (${first ? first[0] + "." : ""}${last ? last[0] +".": ""}):
    </span>
    <span style="font-size:13px; color: #07226c;
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
    const initials = `${first ? first[0] + "." : ""}${last ? last[0] + "." : ""}`;

    expandedStoryHTML = `
<div style="margin-top: 36px;">
    <h2 style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">
    Expanded Resident Success Story: ${initials}
    </h2>
    <div style="border-left: 3px solid #D3F1FC; padding-left: 16px; margin: 16px 0; color: #07226c;">
    <p>${expandedStory.engagement_summary_text}</p>
    </div>
</div>
`;
}


    const htmlContentVal = `
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Puzzle SNF Report for ${nursingHomeName}</title>
</head>

<body style="margin:0 20px; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif;">
    <!-- Page wrapper sized to mimic print width (1200px wide for clarity) -->
    <div
        style="width: 1200px; margin: 0 auto; background: #ffffff; padding: 40px; box-sizing: border-box; border-radius: 4px;">

        <!-- Header -->
        <div style="position: relative; width: 100%; ">
            <h1 style="margin: 0; font-size: 40px; color: #07226c; font-weight: 700; line-height: 1;">Puzzle SNF Report
                for ${nursingHomeName}</h1>
        </div>

        <div style="margin-top: 50px; display: flex; align-items: center; width: 100%;">

            <div style="width: 60%; padding-right: 20px; box-sizing: border-box;">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">Executive Summary
                </h2>
                <p style="margin: 0; font-size: 15px; color: #07226c; line-height: 1.6;">
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
                            ${patientMetrics?.totalPuzzlePatients}</td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">-</td>
                        </tr>
                        <tr>
                        <td style="padding:14px; border:1px solid #eef4f9;">30-Day Readmissions (Puzzle Patients)
                        </td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;">
                            ${patientMetrics?.commulative30DayReadmissionCount_fromSNFAdmitDate}</td>
                        <td style="text-align:center; padding:14px; border:1px solid #eef4f9;">
                            ${patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size:14px; margin:12px 0 0 0;color: #07226c;">Note: Readmissions reflect only patients
                    supported by Puzzle Continuity Care.</p>
            </div>
        </div>

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
                                Number Delivered
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
                                        Number of Patients</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHTML}
                            </tbody>
                        </table>
                </div>

            </div>
    
            <div style="margin-top: 36px;">
                <h2 style="font-size: 26px; color: #07226c; font-weight: 800; margin: 0 0 14px 0;">Key Interventions and
                    Outcomes</h2>
                ${keyOutcomesHTML}
            </div>
            <div style="margin-top: 36px;">
                <h2 style="margin: 0 0 0 0; font-size: 28px;margin-bottom:16px; color: #07226c; font-weight: 700;">Case Study
                    Highlights: Individual Patient Successes</h2>
                ${cardsHTML}
            </div>
            ${expandedStoryHTML}
            <div style="margin-top: 36px;">
                <h2 style="margin: 0 0 16px 0; font-size: 28px; color: #07226c; font-weight: 700;">National Benchmark
                    Comparison</h2>
                <div>
                    <table style="width:100%; border-collapse: collapse; font-size:14px;   color: #07226c;">
                        <thead>
                            <tr>
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
                            <tr>
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">30-Day Readmission Rate (Puzzle
                                    Patients)</td>
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">
                                    ${patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%</td>
                                <td style="padding:14px; border:1px solid #eef4f9;background: #f5f5f5;">
                                    ${patientMetrics?.nationalReadmissionsBenchmark}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p style="font-size:13px; margin:12px 0 0 0; color: #07226c;">Source: CMS SNF QRP 2024 National Averages.</p>
            </div>


            <div style="margin-top: 36px;">
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
            <div style="margin-top: 36px;">
                <h2 style="margin: 0 0 0 0; font-size: 28px; color: #07226c; font-weight: 700;margin-bottom:16px;">Closing Summary</h2>
                <p style="color: #07226c;">${patientMetrics?.closingStatement}</p>
            </div>
        </div>
</body>

</html>
   `;

    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.innerHTML = htmlContentVal;
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 300));

    const canvas = await html2canvas(container, {
        scale: 2.5, 
        useCORS: true,
        allowTaint: true
    });

    document.body.removeChild(container);

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

const marginLeft = 10;   // mm
const marginRight = 10;  // mm
const marginTop = 10;    // mm
const marginBottom = 10; // mm

const usablePageWidth = pageWidth - marginLeft - marginRight;
const usablePageHeight = pageHeight - marginTop - marginBottom;


const pxPerMm = canvas.width / usablePageWidth;

const pageHeightPx = Math.floor(usablePageHeight * pxPerMm);

let yPosition = 0;
let remainingHeight = canvas.height;

let firstPage = true;

while (remainingHeight > 0) {
    const sliceHeight = Math.min(pageHeightPx, remainingHeight);

    if (sliceHeight < 52) break;

    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;

    const ctx = pageCanvas.getContext("2d");
    if(ctx){
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

    }

    const imgData = pageCanvas.toDataURL("image/jpeg",1);

    const imgHeight = (sliceHeight / canvas.width) * usablePageWidth;

    if (firstPage) {
        pdf.addImage(imgData, "JPEG", marginLeft, marginTop, usablePageWidth, imgHeight);
        firstPage = false;
    } else {
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", marginLeft, marginTop, usablePageWidth, imgHeight);
    }

    yPosition += sliceHeight;
    remainingHeight -= sliceHeight;
}

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
    patientMetrics,
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
                            text: "Key Interventions and Outcomess",
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
                        /*
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
                        */
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
            text: (() => {
                const safeName = study.patient_name || "Unknown Patient";
                const [first, last] = safeName.split(" ");
                return first && last ? `${first[0]}.${last}` : safeName;
            })(),
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
            text: study.highlight_text || "",
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
