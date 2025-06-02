ALTER TABLE facilities
ADD COLUMN  IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE facilities
ADD COLUMN IF NOT EXISTS updated_by TEXT REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE nursing_homes
ADD COLUMN city TEXT,
ADD COLUMN state TEXT,
ADD COLUMN zipCode TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN email TEXT,
ADD COLUMN website TEXT;

ALTER TABLE nursing_homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Full access on users"
    ON nursing_homes FOR ALL
    USING (true)
    WITH CHECK (true);


CREATE TABLE permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(resource, action)
);

-- Create role_permissions table
CREATE TABLE role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id UUID REFERENCES permissions(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(role, permission_id)
);


-- Insert default permissions
INSERT INTO permissions (resource, action) VALUES
  -- Facility permissions
  ('facility', 'create'),
  ('facility', 'read'),
  ('facility', 'update'),
  ('facility', 'delete'),
  -- User permissions
  ('user', 'create'),
  ('user', 'read'),
  ('user', 'update'),
  ('user', 'delete'),
  -- Nursing home permissions
  ('nursing_home', 'create'),
  ('nursing_home', 'read'),
  ('nursing_home', 'update'),
  ('nursing_home', 'delete'),
  -- Document permissions
  ('document', 'create'),
  ('document', 'read'),
  ('document', 'update'),
  ('document', 'delete'),
  -- Report permissions
  ('report', 'read');

-- Insert superadmin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'superadmin', id FROM permissions;

-- Insert facility_admin permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'facility_admin', id
FROM permissions 
WHERE (resource, action) NOT IN (
  ('facility', 'create'),
  ('facility', 'delete')
);

-- Insert facility_user permissions
INSERT INTO role_permissions (role, permission_id)
SELECT 'facility_user', id
FROM permissions 
WHERE (resource, action) IN (
  ('facility', 'read'),
  ('user', 'read'),
  ('nursing_home', 'read'),
  ('document', 'create'),
  ('document', 'read'),
  ('report', 'read')
);