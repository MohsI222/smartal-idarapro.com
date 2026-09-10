-- Enable Realtime for POS Agent tables
-- This enables Supabase Realtime for instant synchronization between apps

-- Enable realtime for pos_agent_sales table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_agent_sales;

-- Enable realtime for inventory_products table (if not already enabled)
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_products;

-- Enable realtime for pos_agent_sales_lines table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_agent_sales_lines;

-- Enable realtime for pos_agent_attendance table
ALTER PUBLICATION supabase_realtime ADD TABLE public.pos_agent_attendance;
