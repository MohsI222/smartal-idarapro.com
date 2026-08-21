-- Wedding Invitations Table
-- Stores wedding invitation templates and user data

CREATE TABLE IF NOT EXISTS wedding_invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS wedding_invitations_user_id_idx ON wedding_invitations(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS wedding_invitations_created_at_idx ON wedding_invitations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE wedding_invitations ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own invitations
CREATE POLICY "Users can view own wedding invitations"
  ON wedding_invitations FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own invitations
CREATE POLICY "Users can insert own wedding invitations"
  ON wedding_invitations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own invitations
CREATE POLICY "Users can update own wedding invitations"
  ON wedding_invitations FOR UPDATE
  USING (auth.uid() = user_id);

-- Create policy to allow users to delete their own invitations
CREATE POLICY "Users can delete own wedding invitations"
  ON wedding_invitations FOR DELETE
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_wedding_invitations_updated_at
  BEFORE UPDATE ON wedding_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
