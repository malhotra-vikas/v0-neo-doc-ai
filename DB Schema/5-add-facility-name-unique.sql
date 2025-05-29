-- Add unique constraint for facility name
ALTER TABLE facilities 
ADD CONSTRAINT facilities_name_unique UNIQUE (name);
