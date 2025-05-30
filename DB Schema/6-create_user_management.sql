-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- Drop policies if they exist
DROP POLICY IF EXISTS "Superadmin full access on users" ON users;
DROP POLICY IF EXISTS "Superadmin full access on facilities" ON facilities;
DROP POLICY IF EXISTS "Facility admin access on users" ON users;
DROP POLICY IF EXISTS "Facility admin access on own facility" ON facilities;
DROP POLICY IF EXISTS "Authenticated users can access their user_roles" ON user_roles;
DROP POLICY IF EXISTS "Public read access to email only" ON users;
DROP POLICY IF EXISTS "Full access on users" ON users;
DROP POLICY IF EXISTS "Full access on facilities" ON facilities;
DROP POLICY IF EXISTS "Full access on user_roles" ON user_roles;

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_facilities_updated_at ON facilities;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS facilities CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop enums
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS user_status CASCADE;


-- Create role enum
CREATE TYPE user_role AS ENUM ('superadmin', 'facility_admin', 'facility_user');

-- Create user status enum
CREATE TYPE user_status AS ENUM ('pending', 'active', 'inactive', 'suspended');

CREATE TABLE users (
    id TEXT primary key,
    email TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    status user_status DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Create facilities table
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT REFERENCES users(id)
);

-- Create user_roles table for role-facility mapping
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT REFERENCES users(id),
    CONSTRAINT unique_user_facility UNIQUE(user_id, facility_id)
);

-- Add indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_facility_id ON user_roles(facility_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

    CREATE POLICY "Full access on users"
    ON users FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Full access on facilities"
    ON facilities FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Full access on user_roles"
    ON user_roles FOR ALL
    USING (true)
    WITH CHECK (true);


CREATE POLICY "Public read access to email only"
ON users
FOR SELECT
TO public
USING (true);



-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

ALTER TABLE nursing_homes 
ADD COLUMN facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE;

UPDATE nursing_homes 
SET facility_id = (SELECT id FROM facilities LIMIT 1)
WHERE facility_id IS NULL;

CREATE INDEX idx_nursing_homes_facility_id ON nursing_homes(facility_id);



DO $$
DECLARE
    uid uuid;
BEGIN
    INSERT INTO users (
        id,
        email,
        status,
        email_verified
    )
    VALUES (
        '2983xSlD3SWRCXXfi9167LAM20h2',
        'malhotra.vikas@gmail.com',
        'active',
        true
    );

    INSERT INTO user_roles (
        user_id,
        role
    )
    VALUES (
        '2983xSlD3SWRCXXfi9167LAM20h2',
        'superadmin'
    );
END $$;