-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX audit_logs_action_type_idx ON audit_logs(action_type);
CREATE INDEX audit_logs_entity_type_idx ON audit_logs(entity_type);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at);

-- Create function to add audit log
CREATE OR REPLACE FUNCTION add_audit_log(
  p_user_id UUID,
  p_user_email TEXT,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT,
  p_details JSONB,
  p_ip_address TEXT,
  p_user_agent TEXT
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO audit_logs (
    user_id,
    user_email,
    action_type,
    entity_type,
    entity_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    p_user_id,
    p_user_email,
    p_action_type,
    p_entity_type,
    p_entity_id,
    p_details,
    p_ip_address,
    p_user_agent
  ) RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
