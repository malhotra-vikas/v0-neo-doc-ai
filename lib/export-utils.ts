import { jsPDF } from "jspdf";
import { Document, Paragraph, TextRun, HeadingLevel, ImageRun, Tab, AlignmentType, BorderStyle, Packer, IStylesOptions, Footer, PageNumber, TableRow, TableCell, Table, WidthType, LineRuleType, VerticalAlign, TableLayoutType, ShadingType, PageOrientation, Spacing, HeightRule } from 'docx';
import html2canvas from 'html2canvas';
import card1 from "../public/card1.png"
import card2 from "../public/card2.png"
import card3 from "../public/card3.png"
import html2pdf from "html2pdf.js";

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
    interventionCounts: { name: string; count: number }[];
    clinicalRisks: { risk: string; count: number }[];

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

    const logoUrl = patientMetrics?.publicLogoLink ?? null;

    let interventionTableRowsHTML = '';

    interventionCounts.forEach((item, index) => {
        const background = index % 2 === 0 ? 'background: #f5f5f5;' : '';
        interventionTableRowsHTML += `
    <tr class="avoid-page-break">
      <td  style="padding:8px; border:1px solid #eef4f9; ${background}">${item.name}</td>
      <td  style="text-align:center; padding:8px; border:1px solid #eef4f9; ${background}">${item.count}</td>
    </tr>
  `;
    });

    // 🔑 Filter out any case study with no engagement_summary_text
    const outcomeFilteredCaseStudies = caseStudies.filter(
        story => story.engagement_summary_text && story.engagement_summary_text.trim().length > 0
    );

let keyOutcomesHTML = outcomeFilteredCaseStudies.map((study, index) => {
  const [first, last] = (study.patient_name || "").split(" ");
  const shortName = first && last ? `${first[0]}. ${last}` : (study.patient_name || "Unknown");

  const interventionsHTML = (study.detailed_interventions || [])
    .map(item => `
      <div style="display:flex; align-items:flex-start; margin:0 0 2px 0; line-height:1.2;">
        <span style="font-size:9px; margin-right:6px;">•</span>
        <span style="font-size:9px; color:#07226c;">${item.intervention}</span>
      </div>
    `).join("");

  const outcomesHTML = (study.detailed_outcomes || [])
    .map(item => `
      <div style="display:flex; align-items:flex-start; margin:0 0 2px 0; line-height:1.2;">
        <span style="font-size:9px; margin-right:6px;">•</span>
        <span style="font-size:9px; color:#07226c;">${item.outcome}</span>
      </div>
    `).join("");

  return `
    <div class="avoid-page-break" style="
      margin-top: ${index === 0 ? "0" : "2px"};
      margin-bottom:4px;
      break-inside: avoid;
      page-break-inside: avoid;
    ">
      <div style="font-size:9px; font-weight:bold; color:#07226c; margin:0 0 2px 0;">
        ${shortName}:
      </div>

      ${interventionsHTML ? `
        <div style="font-size:9px; font-weight:500; color:#07226c; margin:0 0 2px 0;">
          Interventions:
        </div>
        ${interventionsHTML}
      ` : ""}

      ${outcomesHTML ? `
        <div style="font-size:9px; font-weight:500; color:#07226c; margin:4px 0 2px 0;">
          Outcomes:
        </div>
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
      <td style="padding:8px; border:1px solid #eef4f9;${background}">${item.risk}</td>
      <td  style="text-align:center; padding:8px; border:1px solid #eef4f9;${background}">${item.count}</td>
    </tr>
  `;
    });


    let cardsHTML = `
    <div style="
    display: flex;
    flex-wrap: wrap;
    gap: 10px 8px;
    color: #07226c;
    ">
    `;

    let filteredCaseStudies = caseStudies.filter(item => item.patient_id !== expandedPatientId);

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
    padding: 3px;
    color: #07226c;
    border: 1px solid #d7e3f4;
    border-radius: 8px;
    box-sizing: border-box;
    margin-bottom: 4px;
    line-height:1.2;
  " >
    <span class="avoid-page-break" style="font-weight:bold;font-size:9px; color:#002d74; margin-right:6px;">
      ${first ? first[0] + "." : ""}${last ? last : ""}:
    </span>
    <span class="avoid-page-break" style="font-size:8px; color: #07226c;
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
    padding: 4px;
    color: #07226c;
    border: 1px solid #d7e3f4;
    border-radius: 8px;
    box-sizing: border-box;
    margin-bottom: 9px;
    margin-top:9px;
">
  <h2 style="margin: 0 0 9px 0; font-size: 12px; color: #07226c; font-weight: 700;">
    Expanded Resident Success Story: ${initials}
  </h2>
  <p style="font-size:8px; color: #07226c;">
    ${expandedStory.hospital_discharge_summary_text}
    ${expandedStory.facility_summary_text}
    ${expandedStory.engagement_summary_text}
  </p>
</div>
`;
    }


    const htmlContentVal = `
<html lang="en">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Puzzle SNF Report for ${nursingHomeName}</title>
     <style>
    .avoid-page-break {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    table {
      page-break-inside: avoid !important;
    }
  </style>
</head>


<body style="margin:0 20px; padding:0; background:#f6f7fb; font-family: Arial, Helvetica, sans-serif;">
    <!-- Page wrapper sized to mimic print width (1200px wide for clarity) -->
   <div style="max-width: 100%; width: 100%; margin: 0 auto; padding: 20px; box-sizing: border-box;">


        <!-- Header -->
        <div style="position: relative; width: 100%; ">
            <h1 style="margin: 0; font-size: 23px; color: #07226c; font-weight: 700; line-height: 1;">Puzzle SNF Report
                for ${nursingHomeName}</h1>
        </div>

        <div style="margin-top: 25px; display: flex; align-items: center; width: 100%;">

            <div style="width: 60%; padding-right: 20px; box-sizing: border-box;">
                <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #07226c; font-weight: 700;">Executive Summary
                </h2>
                <p class="avoid-page-break" style="margin: 0; font-size: 9px; color: #07226c; line-height: 1.6;">
                    ${patientMetrics?.executiveSummary}
                </p>
            </div>

            ${logoUrl
            ? `<div style="width: 40%; display: flex; align-items: center; justify-content: center;">
            <img src="${logoUrl}" alt="Logo" style="max-width: 100%; max-height: 90px; object-fit: contain;" />
          </div>`
            : ''
        }

        </div>

        <!-- Section title -->
        <div style="margin-top: 22px;" class="avoid-page-break">
            <h2 style="font-size: 16px; color: #07226c; font-weight: 800; margin: 0 0 14px 0;margin-bottom: 16px;">Patient Snapshot
                Overview: 30-Day Readmissions</h2>

            <!-- Table -->
            <div style="width: 100%;margin-top:16px">
                <table style="width:100%; border-collapse: collapse; font-size:8px;color: #07226c;">
                    <thead>
                        <tr>
                        <th style="text-align:left; padding:8px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Metric</th>
                        <th
                            style="width:80px; text-align:center; padding:8px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Count</th>
                        <th
                            style="width:90px; text-align:center; padding:8px; border:1px solid #e6edf5;  font-weight:700; color:#07226c;">
                            Percentage</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                        <td style="padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">Total Puzzle Continuity Care Patients
                            Tracked</td>
                        <td style="text-align:center; padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">
                            ${patientMetrics?.totalPuzzlePatients}</td>
                        <td style="text-align:center; padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">-</td>
                        </tr>
                        <tr>
                        <td style="padding:8px; border:1px solid #eef4f9;">30-Day Readmissions (Puzzle Patients)
                        </td>
                        <td style="text-align:center; padding:8px; border:1px solid #eef4f9;">
                            ${patientMetrics?.commulative30DayReadmissionCount_fromSNFAdmitDate}</td>
                        <td style="text-align:center; padding:8px; border:1px solid #eef4f9;">
                            ${patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%</td>
                        </tr>
                    </tbody>
                </table>
                <p style="font-size:8px; margin:12px 0 0 0;color: #07226c;">Note: Readmissions reflect only patients
                    supported by Puzzle Continuity Care.</p>
            </div>
        </div>

        <div style="margin-top: 22px;" >
            <div style="height: 8px;"></div>

            <div style="display: flex; gap: 20px; flex-wrap: wrap;" class="avoid-page-break">

                <div
                    style="flex: 1; min-width: 150px; position: relative; padding:12px; border: 1px solid #A0E4F8; border-top: 8px solid #7fdbff; border-radius: 10px;">
                    <div
                        style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 30px; height: 30px; background-color: #7fd9f1; border-radius: 50%; z-index: 2;">
                    </div>
                    <div style="text-align:center; color:#07226c; font-size:12px; font-weight:700; margin-bottom: 16px;">
                        Types of Puzzle Interventions Delivered
                    </div>
                   <table style="width:100%; border-collapse: collapse; font-size:9px; color:#07226c;">
                        <thead>
                            <tr>
                            <th style="text-align:left; padding:8px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
                                Intervention Type
                            </th>
                            <th style="width:80px; text-align:center; padding:8px; border:1px solid #e6edf5; font-weight:700; color:#07226c;">
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
                    style="flex: 1; min-width: 150px; position: relative; padding:12px; border: 1px solid #A0E4F8; border-top: 8px solid #7fdbff; border-radius: 10px;">
                    <div
                        style="position: absolute; top: -20px; left: 50%; transform: translateX(-50%); width: 30px; height: 30px; background-color: #7fd9f1; border-radius: 50%; z-index: 2;">
                    </div>
                    <div style="text-align:center; color:#07226c; font-size:12px; font-weight:700; margin-bottom: 16px;">
                        Top Clinical Risks Identified at Discharge
                    </div>
                    <table style="width:100%; border-collapse: collapse; font-size:9px; color:#07226c;">
                            <thead>
                                <tr>
                                    <th
                                        style="text-align:left; padding:8px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                        Clinical Risk</th>
                                    <th
                                        style="width:140px; text-align:center; padding:8px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
                                        Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHTML}
                            </tbody>
                        </table>
                </div>

            </div>
    
            <div style="margin-top: 22px;">
             <div  class="avoid-page-break">
             <h2 style="font-size: 16px; color: #07226c; font-weight: 800; margin: 0 0 8px 0;">Key Interventions and
                 Outcomes</h2>
             </div>
                ${keyOutcomesHTML}
            </div>
             <div  class="avoid-page-break" style="margin-top: 22px;">
             <h2 style="margin: 0 0 0 0; font-size: 16px;margin-bottom:6px; color: #07226c; font-weight: 700;">
                 Case Study Highlights: Individual Patient Successes
             </h2>
             </div>
             ${cardsHTML}
            ${expandedStoryHTML}
            <div class="avoid-page-break" style="margin-top: 22px;display:inline-block; width:100%;">
  <h2 style="font-size: 16px; color: #07226c; font-weight: 700;">
    National Benchmark Comparison
  </h2>
</div>

	  <!-- Table -->
	  <div class="avoid-page-break" style="display:inline-block; width:100%;">
	    <table style="width:100%; border-collapse: collapse; font-size:8px; color: #07226c;">
	      <thead>
		<tr>
		  <th style="width:33.33%; text-align:left; padding:8px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
		    Metric
		  </th>
		  <th style="width:33.33%; text-align:left; padding:8px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
		    ${nursingHomeName}
		  </th>
		  <th style="width:33.33%; text-align:left; padding:8px; border:1px solid #e6edf5;font-weight:700; color:#07226c;">
		    National Benchmark*
		  </th>
		</tr>
	      </thead>
	      <tbody>
		<tr>
		  <td style="padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">
		    30-Day Readmission Rate (Puzzle Patients)
		  </td>
		  <td style="padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">
		    ${patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%
		  </td>
		  <td style="padding:8px; border:1px solid #eef4f9;background: #f5f5f5;">
		    ${patientMetrics?.nationalReadmissionsBenchmark}%
		  </td>
		</tr>
	      </tbody>
	    </table>
	  </div>

	  <div class="avoid-page-break">
	    <p style="font-size:8px; margin:4px 0 0 0; color: #07226c;">
	      Source: CMS SNF QRP 2024 National Averages.
	    </p>
	  </div>


            <div style="margin-top: 22px;" class="avoid-page-break" style="display:block; width:100%;">
                <h2 style="margin: 0 0 9px 0; font-size: 16px; color: #07226c; font-weight: 700;margin-bottom:16px;">Ongoing Focus Areas
                </h2>


                <div id="card-wrapper" 
                    style="display: flex; gap: 24px; justify-content: start; background: white;margin-top: 24px;">
                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 60px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="60" viewBox="0 0 366 80" preserveAspectRatio="none"
                                style="position: absolute; top:0; left:0; z-index: 0;">
                                <polygon points="0,0 329,0 366,40 329,80 0,80 37,40" fill="#D3F1FC" />
                            </svg>
                            <img src="https://img.icons8.com/ios-filled/24/07226c/hospital-room.png"
                                style="width: 24px; height: 24px; position: relative; z-index: 1;" />
                        </div>
                        <div
                            style="font-size: 12px; font-weight: bold; color: #07226c; margin-top: 12px; margin-left:30px; text-align: left;">
                            Reduce Readmissions
                        </div>
                        <div
                            style="font-size: 9px; color: #07226c; margin-top: 6px; line-height: 1.4;text-align: left;margin-left:30px;">
                            Through proactive escalation and<br />earlier detection.
                        </div>
                    </div>

                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 60px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="60" viewBox="0 0 366 80" preserveAspectRatio="none"
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
                            style="font-size: 12px; font-weight: bold; color: #07226c; margin-top: 12px;text-align: left;margin-left:30px;">
                            Strengthen Fall Prevention
                        </div>
                        <div
                            style="font-size: 9px; color: #07226c; margin-top: 6px; line-height: 1.4;text-align: left;margin-left:30px;">
                            With enhanced assessments and<br />environment safety reviews.
                        </div>
                    </div>
                    <div style="width: 366px; text-align: center;">
                        <div
                            style="width: 100%; height: 60px; background: transparent; display: flex; justify-content: center; align-items: center; position: relative;">
                            <svg width="100%" height="60" viewBox="0 0 366 80" preserveAspectRatio="none"
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
                            style="font-size: 12px;text-align: left;margin-left:30px; font-weight: bold; color: #07226c; margin-top: 12px;">
                            Advance CHF Management
                        </div>
                        <div
                            style="font-size: 9px; text-align: left;margin-left:30px;color: #07226c; margin-top: 6px; line-height: 1.4;">
                            By prioritizing early symptom<br />monitoring and follow-up adherence.
                        </div>
                    </div>
                </div>
            </div>
            <div style="margin-top: 22px; margin-bottom: 40px">
                <h2 class="avoid-page-break" style="margin: 0 0 0 0; font-size: 16px; color: #07226c; font-weight: 700;margin-bottom:4px;">Closing Summary</h2>
                <p class="avoid-page-break" style="color: #07226c;font-size: 9px;">${patientMetrics?.closingStatement}</p>
            </div>
        </div>
</body>

</html>
   `;

   console.log("htmlContentVal",htmlContentVal)
     const style = document.createElement("style");
  style.innerHTML = `
    .avoid-page-break {
      page-break-inside: avoid; /* jsPDF support */
      break-inside: avoid;      /* modern CSS */
    }
  `;
  document.head.appendChild(style);
   const element = document.createElement("div");
  element.innerHTML = htmlContentVal;
  element.style.width = "730px"; // A4 width at 96dpi
  element.style.boxSizing = "border-box";
  document.body.appendChild(element);

    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: `${nursingHomeName}-case-studies-${monthYear}.pdf`,
      image: { type: "jpeg", quality: 1 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                 pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }

    };

  try {
    if (returnBlob) {
      const blob = await html2pdf().set(opt).from(element).outputPdf("blob");
      return blob; // return blob to caller
    } else {
      await html2pdf().set(opt).from(element).save();
    }
  } finally {
    document.body.removeChild(element);
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


export const exportToDOCX = async ({
    nursingHomeName,
    monthYear,
    caseStudies,
    patientMetrics,
    categorizedInterventions,
    returnBlob = false,
    interventionCounts,
    clinicalRisks,
    expandedPatientId,
}: ExportDOCXOptions): Promise<Blob | void> => {
    try {
        const reportData: ReportData = {
            facilityName: nursingHomeName,
            totalPatients: patientMetrics?.totalPuzzlePatients || 0,
            readmissions: patientMetrics?.commulative30DayReadmissionCount_fromSNFAdmitDate || 0,
            readmissionRate: `${patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%`,
            clinicalRisks: clinicalRisks || [],
            keyInterventions: caseStudies.map(study => ({
                patientId: study.patient_id,
                interventions: study.detailed_interventions?.map(item => item.intervention) || [],
                outcomes: study.detailed_outcomes?.map(item => item.outcome) || [],
                patientName: study.patient_name || "Unknown",
            })),
            caseStudies: caseStudies,
            nationalBenchmark: patientMetrics?.nationalReadmissionsBenchmark ? `${patientMetrics.nationalReadmissionsBenchmark}%` : "N/A",
            executiveSummary: patientMetrics?.executiveSummary || "",
            logoUrl: patientMetrics?.publicLogoLink,
            patientMetrics: patientMetrics,
            interventions: interventionCounts,
            expandedPatientId: expandedPatientId,
        }

        const doc = await generateDocument(reportData);
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
                        text: data.patientMetrics?.totalPuzzlePatients,
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
                        text: data.patientMetrics?.commulative30DayReadmissionCount_fromSNFAdmitDate,
                        borderColor: bodyBorderColor,
                        isCenter: true,
                    }),
                    createCell({
                        text: data.patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1),
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
const generateDocument = async (data: ReportData) => {
    const img1 = await loadImage(card1.src);
    const img2 = await loadImage(card2.src);
    const img3 = await loadImage(card3.src);
    const doc = new Document({
        styles: createDocumentStyles(),
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 720,
                            right: 720,
                            bottom: 720,
                            left: 720,
                        },
                    },
                },
                children: [
                    new Paragraph({
                        text: `Puzzle SNF Report for ${data.facilityName}`,
                        style: "heading1",
                        spacing: { after: 480 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Executive Summary",
                            }),
                        ],
                        style: "heading2",
                        spacing: { after: 320 },
                    }),

                    new Table({
                        width: {
                            size: 100,
                            type: WidthType.PERCENTAGE,
                        },
                        columnWidths: [6000, 4000], // 60% and 40%
                        borders: noBorder,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        margins: {
                                            top: 0,
                                            bottom: 0,
                                            left: 0,
                                            right: 200,
                                        },
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text:
                                                            data.executiveSummary ||
                                                            "No executive summary provided.",
                                                        size: 10 * 2, // 15pt
                                                        color: COLORS.TEXT,
                                                        font: "Arial",
                                                    }),
                                                ],
                                                spacing: { before: 0, after: 0 },
                                            }),
                                        ],
                                        verticalAlign: VerticalAlign.TOP,
                                    }),
                                    new TableCell({
                                        verticalAlign: VerticalAlign.CENTER,
                                        borders: noBorder,
                                        margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                        children: [
                                            new Paragraph({
                                                alignment: AlignmentType.CENTER,
                                                children: data.logoUrl
                                                    ? [
                                                        new ImageRun({
                                                            data: await fetchImageAsBase64(data.logoUrl),
                                                            transformation: { width: 200, height: 90 },
                                                            type: 'png',
                                                        }),
                                                    ]
                                                    : [],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({ text: "", spacing: { after: 360 } }),

                    new Paragraph({
                        text: "Patient Snapshot Overview: 30-Day Readmissions",
                        style: "heading2",
                        spacing: { before: 150 },
                    }),
                    createStyledTable(data),
                    new Paragraph({
                        text: "Note: Readmissions reflect only patients supported by Puzzle Continuity Care.",
                        style: "normalText",
                        spacing: { before: 120, after: 240 },
                    }),
                    new Paragraph({ text: "", spacing: { before: 360 } }),
                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        rows: [
                            new TableRow({
                                children: [
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        margins: { right: 240 },
                                        borders: {
                                            top: { style: BorderStyle.SINGLE, size: 16, color: "7FDBFF" },
                                            bottom: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                            left: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                            right: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                        },
                                        children: [
                                            createCard(
                                                "Types of Puzzle Interventions Delivered",
                                                createDataRows(
                                                    data.interventions.map((i) => ({
                                                        name: i.name,
                                                        count: i.count,
                                                    })),
                                                    true
                                                )
                                            ),
                                        ],
                                    }),
                                    new TableCell({
                                        width: { size: 50, type: WidthType.PERCENTAGE },
                                        margins: { left: 240 },
                                        borders: {
                                            top: { style: BorderStyle.SINGLE, size: 16, color: "7FDBFF" },
                                            bottom: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                            left: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                            right: { style: BorderStyle.SINGLE, size: 4, color: "A0E4F8" },
                                        },
                                        children: [
                                            createCard(
                                                "Top Clinical Risks Identified at Discharge",
                                                createDataRows(
                                                    data.clinicalRisks.map((r) => ({
                                                        risk: r.risk,
                                                        count: r.count,
                                                    })),
                                                    false
                                                )
                                            ),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new Paragraph({ text: "", spacing: { after: 360 } }),
                    new Paragraph({
                        text: "Key Interventions and Outcomes",
                        style: "heading2",
                        spacing: { before: 360, after: 280 },
                    }),

                    ...data.keyInterventions.map(study => {
                        const patientName = study.patientName.split(" ");
                        const shortName = patientName.length >= 2
                            ? `${patientName[0][0]}.${patientName[1][0]}.`
                            : study.patientName;

                        return [
                            new Paragraph({
                                children: [
                                    new TextRun({
                                        text: `(${shortName}):`,
                                        size: 20,
                                        bold: true,
                                        color: "07226c",
                                        font: "Arial",
                                    }),
                                ],
                                spacing: { before: 240, after: 120 },
                            }),

                            ...(study.interventions.length > 0 ? [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: "Interventions:",
                                            size: 20,
                                            bold: true,
                                            color: "07226c",
                                            font: "Arial",
                                        }),
                                    ],
                                    spacing: { before: 120, after: 80 },
                                }),
                                ...study.interventions.map(intervention =>
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: "•  ",
                                                size: 20,
                                                color: "07226c",
                                                font: "Arial",
                                            }),
                                            new TextRun({
                                                text: intervention,
                                                size: 20,
                                                color: "07226c",
                                                font: "Arial",
                                            }),
                                        ],
                                        indent: { left: 360 },
                                        spacing: { before: 80, after: 80 },
                                    })
                                ),
                            ] : []),
                            ...(study.outcomes.length > 0 ? [
                                new Paragraph({
                                    children: [
                                        new TextRun({
                                            text: "Outcomes:",
                                            size: 20,
                                            bold: true,
                                            color: "07226c",
                                            font: "Arial",
                                        }),
                                    ],
                                    spacing: { before: 120, after: 80 },
                                }),
                                ...study.outcomes.map(outcome =>
                                    new Paragraph({
                                        children: [
                                            new TextRun({
                                                text: "•  ",
                                                size: 20,
                                                color: "07226c",
                                                font: "Arial",
                                            }),
                                            new TextRun({
                                                text: outcome,
                                                size: 20,
                                                color: "07226c",
                                                font: "Arial",
                                            }),
                                        ],
                                        indent: { left: 360 },
                                        spacing: { before: 80, after: 80 },
                                    })
                                ),
                            ] : []),

                            // Add spacing after each patient section
                            new Paragraph({
                                text: "",
                                spacing: { after: 240 },
                            }),
                        ];
                    }).flat(),
                    new Paragraph({
                        text: "Case Study Highlights: Individual Patient Successes",
                        style: "heading2",
                        spacing: { before: 360, after: 150 },
                    }),


                    createCardLayoutTable(data.caseStudies, data.expandedPatientId),
                    ...(data.expandedPatientId ? [
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: `Expanded Resident Success Story: ${(() => {
                                        const story = data.caseStudies.find(study => study.patient_id === data.expandedPatientId);
                                        if (!story?.patient_name) return "";
                                        const parts = story.patient_name.trim().split(/\s+/);
                                        const firstInitial = parts[0]?.[0] ? parts[0][0] + "." : "";
                                        const lastInitial = parts[1]?.[0] ? parts[1][0] + "." : "";
                                        return `${firstInitial}${lastInitial}`;
                                    })()}`,
                                    bold: true,
                                    size: 40,
                                    font: "Arial",
                                    color: "07226C",
                                }),
                            ],
                            spacing: { before: 720, after: 100 },
                        }),
                        ...createCaseStudyCard(data.caseStudies.find(study => study.patient_id === data.expandedPatientId)),
                    ] : []),

                    new Paragraph({
                        text: "National Benchmark Comparison",
                        style: "heading2",
                        spacing: { before: 720, after: 320 },
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        layout: TableLayoutType.FIXED,
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 4, color: "e6edf5" },
                            bottom: { style: BorderStyle.SINGLE, size: 4, color: "e6edf5" },
                            left: { style: BorderStyle.SINGLE, size: 4, color: "e6edf5" },
                            right: { style: BorderStyle.SINGLE, size: 4, color: "e6edf5" },
                        },
                        rows: [
                            // Header Row
                            new TableRow({
                                children: [
                                    createCell({
                                        text: "Metric",
                                        isHeader: true,
                                        bold: true,
                                        borderColor: "e6edf5",
                                        bgColor: undefined,
                                        isCenter: false,
                                    }),
                                    createCell({
                                        text: data.facilityName,
                                        isHeader: true,
                                        bold: true,
                                        borderColor: "e6edf5",
                                        isCenter: false,
                                    }),
                                    createCell({
                                        text: "National Benchmark*",
                                        isHeader: true,
                                        bold: true,
                                        borderColor: "e6edf5",
                                        isCenter: false,
                                    }),
                                ],
                            }),
                            // Data Row
                            new TableRow({
                                children: [
                                    createCell({
                                        text: "30-Day Readmission Rate (Puzzle Patients)",
                                        borderColor: "eef4f9",
                                        bgColor: "f5f5f5",
                                        isCenter: false,
                                    }),
                                    createCell({
                                        text: `${data.patientMetrics?.commulative30Day_ReadmissionRate.toFixed(1)}%`,
                                        borderColor: "eef4f9",
                                        bgColor: "f5f5f5",
                                        isCenter: false,
                                    }),
                                    createCell({
                                        text: `${data.patientMetrics?.nationalReadmissionsBenchmark}%`,
                                        borderColor: "eef4f9",
                                        bgColor: "f5f5f5",
                                        isCenter: false,
                                    }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Source: CMS SNF QRP 2024 National Averages.",
                                size: 20,
                                color: "07226c",
                                font: "Arial",
                            }),
                        ],
                        spacing: { before: 240, after: 240 },
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Ongoing Focus Areas",
                                font: "Arial",
                                size: 40, // 28px
                                bold: true,
                                color: "07226C",
                            }),
                        ],
                        spacing: { before: 720, after: 320 },
                    }),

                    new Table({
                        width: { size: 100, type: WidthType.PERCENTAGE },
                        borders: noBorder,
                        rows: [
                            new TableRow({
                                children: [
                                    // First card
                                    new TableCell({
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new ImageRun({
                                                        data: img1,
                                                        transformation: { width: 218, height: 65 }, // Fits cell
                                                        type: "png",
                                                    }),
                                                ],
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "Reduce Readmissions",
                                                        bold: true,
                                                        font: "Arial",
                                                        size: 24,
                                                        color: "07226C",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "Through proactive escalation and earlier detection.",
                                                        size: 20,
                                                        font: "Arial",
                                                        color: "07226C",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },
                                            }),
                                        ],
                                    }),

                                    // Second card
                                    new TableCell({
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new ImageRun({
                                                        data: img2,
                                                        transformation: { width: 218, height: 65 }, // Fits cell
                                                        type: "png",
                                                    }),
                                                ],
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "Strengthen Fall Prevention",
                                                        bold: true,
                                                        font: "Arial",
                                                        size: 24,
                                                        color: "07226C",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },

                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "With enhanced assessments and environment safety reviews.",
                                                        size: 20,
                                                        font: "Arial",
                                                        color: "07226C",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },
                                            }),
                                        ],
                                    }),

                                    // Third card
                                    new TableCell({
                                        borders: noBorder,
                                        children: [
                                            new Paragraph({
                                                children: [
                                                    new ImageRun({
                                                        data: img3,
                                                        transformation: { width: 218, height: 65 }, // Fits cell
                                                        type: "png",
                                                    }),
                                                ],
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "Advance CHF Management",
                                                        bold: true,
                                                        size: 24,
                                                        font: "Arial",
                                                        color: "07226C",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },
                                            }),
                                            new Paragraph({
                                                children: [
                                                    new TextRun({
                                                        text: "By prioritizing early symptom monitoring and follow-up adherence.",
                                                        size: 20,
                                                        color: "07226C",
                                                        font: "Arial",
                                                    }),
                                                ],
                                                spacing: { before: 150, after: 150 },
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),

                    new Paragraph({
                        children: [
                            new TextRun({
                                text: "Closing Summary",
                            }),
                        ],
                        style: "heading2",
                        spacing: { before: 720, after: 200 },
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: data.patientMetrics.closingStatement,
                                color: "07226c",
                                font: "Arial",
                                size: 20,
                            }),
                        ],
                        alignment: AlignmentType.LEFT,
                        spacing: { after: 240 },
                    }),
                ],
            },
        ],
    });

    return doc;
};