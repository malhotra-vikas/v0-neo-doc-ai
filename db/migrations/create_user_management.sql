-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create role enum
CREATE TYPE user_role AS ENUM ('superadmin', 'facility_admin', 'facility_user');

-- Create user status enum
CREATE TYPE user_status AS ENUM ('pending', 'active', 'inactive', 'suspended');

-- Create facilities table
CREATE TABLE facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Create users table (extends Supabase auth.users)
CREATE TABLE users (
    id uuid primary key references auth.users(id) on delete cascade,
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

-- Create user_roles table for role-facility mapping
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
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

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Superadmin policies
CREATE POLICY "Superadmin full access on users"
    ON users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    );

CREATE POLICY "Superadmin full access on facilities"
    ON facilities FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'superadmin'
        )
    );

CREATE POLICY "Facility admin access on users"
    ON users FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
            AND ur.role = 'facility_admin'
            AND ur.facility_id IN (
                SELECT facility_id FROM user_roles
                WHERE user_id = users.id
            )
        )
    );

CREATE POLICY "Facility admin access on own facility"
    ON facilities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_id = auth.uid()
            AND role = 'facility_admin'
            AND facility_id = facilities.id
        )
    );

    CREATE POLICY "Authenticated users can access their user_roles"
    ON public.user_roles
    AS PERMISSIVE
    FOR ALL
    TO authenticated
    USING (
    auth.uid() = user_id
    )
    WITH CHECK (
    auth.uid() = user_id
    );

DO $$
DECLARE
    uid uuid;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = 'malhotra.vikas@gmail.com';

    INSERT INTO users (
        id,
        email,
        status,
        email_verified
    )
    VALUES (
        uid,
        'malhotra.vikas@gmail.com',
        'active',
        true
    );

    INSERT INTO user_roles (
        user_id,
        role
    )
    VALUES (
        uid,
        'superadmin'
    );
END $$;
