-- Create the case study highlights table if it doesn't exist
CREATE TABLE IF NOT EXISTS case_study_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES patient_files(id) ON DELETE CASCADE,
  highlight_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(file_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_study_highlights_patient_id ON case_study_highlights(patient_id);
CREATE INDEX IF NOT EXISTS idx_case_study_highlights_file_id ON case_study_highlights(file_id);

-- Add a comment to the table
COMMENT ON TABLE case_study_highlights IS 'Stores AI-generated case study highlights for patient files';
