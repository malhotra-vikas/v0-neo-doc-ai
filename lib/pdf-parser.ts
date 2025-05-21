interface PatientInfo {
  name: string
  dateOfBirth: string
  medicalRecordNumber: string
}

export async function extractPatientInfo(fileContent: string): Promise<PatientInfo | null> {
  try {
    // In a real implementation, you would use a PDF parsing library
    // For this example, we'll use simple string matching on the text content

    // Extract patient name
    let name = ""
    const patientNameMatch = fileContent.match(/PATIENT:\s*([^(]+)/i)
    if (patientNameMatch && patientNameMatch[1]) {
      name = patientNameMatch[1].trim()
    }

    // Clean up the name (remove any trailing parentheses)
    name = name.replace(/\s*$$[^)]*$$$/, "").trim()

    // Extract date of birth
    let dateOfBirth = ""
    const dobMatch =
      fileContent.match(/$$(\d{1,2}\/\d{1,2}\/\d{4})$$/i) ||
      fileContent.match(/Patient DOB:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (dobMatch && dobMatch[1]) {
      // Convert to YYYY-MM-DD format for database
      const parts = dobMatch[1].split("/")
      if (parts.length === 3) {
        const month = parts[0].padStart(2, "0")
        const day = parts[1].padStart(2, "0")
        const year = parts[2]
        dateOfBirth = `${year}-${month}-${day}`
      } else {
        dateOfBirth = dobMatch[1]
      }
    }

    // Extract medical record number
    let medicalRecordNumber = ""
    const mrnMatch = fileContent.match(/MRN:\s*(\d+)/i) || fileContent.match(/GPM MRN:\s*(\d+)/i)
    if (mrnMatch && mrnMatch[1]) {
      medicalRecordNumber = mrnMatch[1].trim()
    }

    // If we couldn't extract the required information, return null
    if (!name) {
      console.error("Could not extract patient name")
      return null
    }

    return {
      name,
      dateOfBirth: dateOfBirth || null,
      medicalRecordNumber: medicalRecordNumber || null,
    }
  } catch (error) {
    console.error("Error extracting patient info:", error)
    return null
  }
}
