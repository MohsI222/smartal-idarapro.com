-- Create missing tables in Supabase
-- Run this in Supabase SQL Editor

-- Create hr_staff table if it doesn't exist
CREATE TABLE IF NOT EXISTS hr_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'staff',
    department TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add created_by column to production_requests if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'production_requests' AND column_name = 'created_by'
    ) THEN
        ALTER TABLE production_requests ADD COLUMN created_by UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Create production_requests table if it doesn't exist
CREATE TABLE IF NOT EXISTS production_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create logistics_queue table if it doesn't exist
CREATE TABLE IF NOT EXISTS logistics_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    production_request_id UUID REFERENCES production_requests(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES hr_staff(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE hr_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for hr_staff
CREATE POLICY "Users can view their own hr_staff record" ON hr_staff
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own hr_staff record" ON hr_staff
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hr_staff record" ON hr_staff
    FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for production_requests
CREATE POLICY "Users can view production_requests" ON production_requests
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert production_requests" ON production_requests
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update production_requests" ON production_requests
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete production_requests" ON production_requests
    FOR DELETE USING (auth.uid() = created_by);

-- Create policies for logistics_queue
CREATE POLICY "Users can view logistics_queue" ON logistics_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert logistics_queue" ON logistics_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update logistics_queue" ON logistics_queue
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete logistics_queue" ON logistics_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON hr_staff TO authenticated;
GRANT ALL ON production_requests TO authenticated;
GRANT ALL ON logistics_queue TO authenticated;
