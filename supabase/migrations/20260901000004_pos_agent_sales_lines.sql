-- Create pos_agent_sales_lines table for storing individual sale line items
CREATE TABLE IF NOT EXISTS pos_agent_sales_lines (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL REFERENCES pos_agent_sales(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
  line_total DECIMAL(10, 2) NOT NULL CHECK (line_total >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_lines_sale_id ON pos_agent_sales_lines(sale_id);
CREATE INDEX IF NOT EXISTS idx_pos_agent_sales_lines_product_id ON pos_agent_sales_lines(product_id);

-- Enable Row Level Security
ALTER TABLE pos_agent_sales_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to see their own sales lines
CREATE POLICY "Users can view their own sales lines"
  ON pos_agent_sales_lines
  FOR SELECT
  USING (
    sale_id IN (
      SELECT id FROM pos_agent_sales WHERE user_id = auth.uid()
    )
  );

-- Allow users to insert their own sales lines (through the sales API)
CREATE POLICY "Users can insert their own sales lines"
  ON pos_agent_sales_lines
  FOR INSERT
  WITH CHECK (
    sale_id IN (
      SELECT id FROM pos_agent_sales WHERE user_id = auth.uid()
    )
  );

-- Allow super admin to view all sales lines
CREATE POLICY "Super admin can view all sales lines"
  ON pos_agent_sales_lines
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND email = 'lahcenm534@gmail.com'
    )
  );

-- Allow super admin to manage all sales lines
CREATE POLICY "Super admin can manage all sales lines"
  ON pos_agent_sales_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND email = 'lahcenm534@gmail.com'
    )
  );
