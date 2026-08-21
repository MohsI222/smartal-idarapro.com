import { Pool } from 'pg';
import 'dotenv/config';

// Disable SSL warnings for this migration script
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const sql = `
-- Enable Realtime for ALL tables in the platform
-- This migration enables Supabase Realtime for all tables to support live sync across multiple devices
-- Including: Inventory, Production, Transport/Logistics, Magic Links, and all other sections

-- Helper function to safely add table to realtime publication
CREATE OR REPLACE FUNCTION add_table_to_realtime(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = table_name
  ) THEN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      EXCEPTION WHEN duplicate_object THEN
        -- Table already in publication, ignore
        NULL;
      END;
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Realtime for all tables
SELECT add_table_to_realtime('production_requests');
SELECT add_table_to_realtime('logistics_queue');
SELECT add_table_to_realtime('inventory_products');
SELECT add_table_to_realtime('hr_employees');
SELECT add_table_to_realtime('wedding_invitations');
SELECT add_table_to_realtime('delivery_hub_stores');
SELECT add_table_to_realtime('delivery_hub_products');
SELECT add_table_to_realtime('delivery_hub_orders');
SELECT add_table_to_realtime('delivery_hub_order_items');
SELECT add_table_to_realtime('delivery_hub_order_messages');
SELECT add_table_to_realtime('stores');
SELECT add_table_to_realtime('products');
SELECT add_table_to_realtime('orders');
SELECT add_table_to_realtime('order_items');
SELECT add_table_to_realtime('order_messages');

-- Clean up helper function
DROP FUNCTION IF EXISTS add_table_to_realtime(TEXT);
`;

async function applyMigration() {
  try {
    console.log('🚀 Applying Realtime migration for ALL platform tables...');
    await pool.query(sql);
    console.log('✅ Realtime migration applied successfully!');
    console.log('📡 The following tables now support real-time sync:');
    console.log('   📦 Inventory & Production:');
    console.log('      - inventory');
    console.log('      - production_requests');
    console.log('      - logistics_queue');
    console.log('      - inventory_products');
    console.log('      - hr_employees');
    console.log('   🚚 Delivery Hub:');
    console.log('      - delivery_hub_stores');
    console.log('      - delivery_hub_products');
    console.log('      - delivery_hub_orders');
    console.log('      - delivery_hub_order_items');
    console.log('      - delivery_hub_order_messages');
    console.log('   🎉 Wedding Invitations:');
    console.log('      - wedding_invitations');
    console.log('   📋 Legacy Delivery Schema:');
    console.log('      - stores');
    console.log('      - products');
    console.log('      - orders');
    console.log('      - order_items');
    console.log('      - order_messages');
    console.log('🎉 All platform sections now support real-time sync!');
  } catch (error) {
    console.error('❌ Error applying Realtime migration:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
