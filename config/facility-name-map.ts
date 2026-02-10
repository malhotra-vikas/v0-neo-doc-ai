/**
 * Facility name mapping: Bamboo name (key) → source-specific names (ADT, Charge Capture).
 *
 * Only facilities whose ADT or Charge Capture name differs from the
 * Bamboo name need an entry here.  If all three names are identical
 * the lookup falls back to the Bamboo name automatically.
 */

export interface FacilityNameMapping {
    adtName: string;
    ccName: string;
}

export type FacilityNameMap = Record<string, FacilityNameMapping>;

export const facilityNameMap: FacilityNameMap = {

    // ── Accolade ──────────────────────────────────────────────
    "Accolade Healthcare of Paxton Senior Living": {
        adtName: "Accolade Healthcare of Paxton Senior Living - SNF",
        ccName:  "Accolade Healthcare of Paxton Senior Living - SNF",
    },
    "Accolade Healthcare of Peoria": {
        adtName: "Accolade Healthcare of Peoria",
        ccName:  "Accolade Healthcare of Peoria (M)",
    },
    "Accolade Healthcare of Pontiac": {
        adtName: "Accolade Healthcare of Pontiac LLC",
        ccName:  "Accolade Healthcare of Pontiac LLC",
    },

    // ── Allure ────────────────────────────────────────────────
    "Allure of Galesburg": {
        adtName: "Allure of Galesburg",
        ccName:  "Allure of Galesburg (M)",
    },
    "Allure of Lake Storey": {
        adtName: "Allure of Lake Storey",
        ccName:  "Allure of Lake Storey (M)",
    },
    "Allure of Mendota": {
        adtName: "Allure of Mendota",
        ccName:  "Allure Of Mendota",
    },
    "Allure of Quad Cities": {
        adtName: "Allure of Quad Cities",
        ccName:  "Allure of the Quad Cities",
    },

    // ── Other Illinois ────────────────────────────────────────
    "Amberwood Care Centre": {
        adtName: "Amberwood Care Centre",
        ccName:  "AMBD Property LLC dba Amberwood Care Centre (M)",
    },
    "Autumn Woods": {
        adtName: "Autumn Woods Residential Health Care LLC",
        ccName:  "Autumn Woods Residential Health Care LLC (M)",
    },
    "Generations at Neighbors": {
        adtName: "Neighbors Care Center",
        ccName:  "Neighbors Care Center (M)",
    },
    "Symphony Maple Crest": {
        adtName: "Maple Crest Care Centre",
        ccName:  "Maple Crest Care Centre (M) (M)",
    },

    // ── Majestic ──────────────────────────────────────────────
    "Majestic Care of Battle Creek": {
        adtName: "Majestic of Battle Creek",
        ccName:  "Majestic Care of Battle Creek- SNF",
    },
    "Majestic Care of Livonia": {
        adtName: "Majestic Care of Livonia- SNF",
        ccName:  "Majestic Care of Livonia - SNF",
    },

    // ── Medilodge ─────────────────────────────────────────────
    "Medilodge of Grand Rapids": {
        adtName: "Medilodge of Grand Rapids - SNF",
        ccName:  "Medilodge of Grand Rapids - SNF",
    },
    "Medilodge of Clare": {
        adtName: "Medilodge of Clare",
        ccName:  "Medilodge of Clare (M)",
    },
    "Medilodge of Grand Blanc": {
        adtName: "Medilodge of Grand Blanc",
        ccName:  "Medilodge of Grand Blanc (M)",
    },
    "Medilodge of Monroe": {
        adtName: "Medilodge of Monroe",
        ccName:  "Medilodge of Monroe (M)",
    },
    "Medilodge of Montrose": {
        adtName: "Medilodge of Montrose",
        ccName:  "Medilodge of Montrose (M)",
    },
    "Medilodge of Mount Pleasant": {
        adtName: "Medilodge of Mt. Pleasant",
        ccName:  "Medilodge of Mt. Pleasant (M)",
    },

    // ── The Loft ──────────────────────────────────────────────
    "The Loft of Canton": {
        adtName: "The Loft Rehabilitation & Nursing of Canton",
        ccName:  "The Loft Rehabilitation & Nursing of Canton",
    },
    "The Loft of Decatur": {
        adtName: "The Loft Rehabilitation of Decatur",
        ccName:  "The Loft Rehabilitation of Decatur",
    },
    "The Loft of East Peoria": {
        adtName: "The Loft Rehabilitation of East Peoria",
        ccName:  "The Loft Rehabilitation of East Peoria",
    },
    "The Loft of Eureka": {
        adtName: "The Loft Rehabilitation & Nursing",
        ccName:  "The Loft Rehabilitation & Nursing (M)",
    },
    "The Loft of Normal": {
        adtName: "The Loft Rehabilitation & Nursing of Normal",
        ccName:  "The Loft Rehabilitation & Nursing of Normal (M)",
    },
    "The Loft of Peoria": {
        adtName: "The Loft Rehabilitation of Peoria",
        ccName:  "The Loft Rehabilitation of Peoria",
    },
    "The Loft of Rock Springs": {
        adtName: "The Loft Rehabilitation of Rock Springs",
        ccName:  "The Loft Rehabilitation of Rock Springs",
    },
};
