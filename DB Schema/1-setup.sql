-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create nursing_homes table
CREATE TABLE nursing_homes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create patients table
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nursing_home_id UUID REFERENCES nursing_homes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  medical_record_number TEXT,
  date_of_birth DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create nursing_home_files table
CREATE TABLE nursing_home_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nursing_home_id UUID REFERENCES nursing_homes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create patient_files table
CREATE TABLE patient_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  month TEXT NOT NULL,
  year TEXT NOT NULL,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert predefined nursing homes
INSERT INTO nursing_homes (name, address) VALUES 
  ('Harborview Briarwood', '123 Harbor Lane, Briarwood, CA 90210'),
  ('Sunshine Edison', '456 Sunshine Blvd, Edison, NJ 08817');