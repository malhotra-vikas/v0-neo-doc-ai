-- Add parsed_text column to patient_files table
ALTER TABLE patient_files ADD COLUMN parsed_text TEXT;
ALTER TABLE patient_files ADD COLUMN processing_status TEXT DEFAULT 'pending';

-- Create a table for the PDF processing queue
CREATE TABLE pdf_processing_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES patient_files(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Create an index for faster queue processing
CREATE INDEX pdf_processing_queue_status_idx ON pdf_processing_queue(status);
