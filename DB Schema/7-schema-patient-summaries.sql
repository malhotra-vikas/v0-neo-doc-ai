-- Create the patient case study highlights table
CREATE TABLE IF NOT EXISTS patient_case_study_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  highlight_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(patient_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_patient_case_study_highlights_patient_id ON patient_case_study_highlights(patient_id);

-- Add a comment to the table
COMMENT ON TABLE patient_case_study_highlights IS 'Stores AI-generated comprehensive case study highlights for patients based on all their files';
