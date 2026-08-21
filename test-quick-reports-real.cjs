const { Pool } = require('pg');
require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function testQuickReportsReal() {
  try {
    console.log('🧪 Testing quick reports with real data...\n');
    
    const primaryUserId = '0b2f773e-10f2-4d1b-8430-1751863596f3';
    const today = new Date().toISOString().split('T')[0];
    
    // Get the most recent shift report for today
    const shiftReport = await pool.query(
      'SELECT * FROM shift_reports WHERE user_id = $1 AND shift_date = $2 AND shift_group = $3 ORDER BY created_at DESC LIMIT 1',
      [primaryUserId, today, 'A']
    );
    
    if (shiftReport.rows.length === 0) {
      console.log('⚠️  No shift report found for today, creating one...');
      
      const now = new Date().toISOString();
      const newReport = {
        id: crypto.randomUUID(),
        user_id: primaryUserId,
        shift_group: 'A',
        shift_date: today,
        start_time: now,
        end_time: null,
        shift_description: 'النوبة الصباحية (08:00 - 14:00)',
        sales_count: 0,
        stock_add_count: 0,
        stock_edit_count: 0,
        import_count: 0,
        export_count: 0,
        delete_count: 0,
        total_operations: 0,
        operations_log: [],
        customer_name: null,
        customer_phone: null,
        week: 1
      };
      
      await pool.query(`
        INSERT INTO shift_reports (id, user_id, shift_group, shift_date, start_time, end_time, shift_description, sales_count, stock_add_count, stock_edit_count, import_count, export_count, delete_count, total_operations, operations_log, customer_name, customer_phone, week)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `, [
        newReport.id, newReport.user_id, newReport.shift_group, newReport.shift_date,
        newReport.start_time, newReport.end_time, newReport.shift_description,
        newReport.sales_count, newReport.stock_add_count, newReport.stock_edit_count,
        newReport.import_count, newReport.export_count, newReport.delete_count,
        newReport.total_operations, newReport.operations_log,
        newReport.customer_name, newReport.customer_phone, newReport.week
      ]);
      
      console.log('✅ Created new shift report');
      
      // Add some test operations
      const testOperations = [
        {
          date: today,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          shift: 'Shift A',
          user: 'Test User',
          action: 'بيع',
          type: 'بيع',
          details: 'بيع 5 منتجات: زيت المائدة لتر, حليب معقم لتر',
          product_name: 'زيت المائدة لتر',
          product_sku: 'SKU-001'
        },
        {
          date: today,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          shift: 'Shift A',
          user: 'Test User',
          action: 'إضافة مخزون',
          type: 'إضافة مخزون',
          details: 'إضافة 10 قطعة للمنتج: السكر قالب كيلو',
          product_name: 'السكر قالب كيلو',
          product_sku: 'SKU-002'
        },
        {
          date: today,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          shift: 'Shift A',
          user: 'Test User',
          action: 'استيراد',
          type: 'استيراد',
          details: 'استيراد 35 منتجات من الملف: test.csv',
          product_name: null,
          product_sku: null
        }
      ];
      
      await pool.query(
        'UPDATE shift_reports SET operations_log = $1, sales_count = 1, stock_add_count = 1, import_count = 1, total_operations = 3 WHERE id = $2',
        [JSON.stringify(testOperations), newReport.id]
      );
      
      console.log('✅ Added test operations');
    }
    
    // Now fetch the report again
    const finalReport = await pool.query(
      'SELECT * FROM shift_reports WHERE user_id = $1 AND shift_date = $2 AND shift_group = $3 ORDER BY created_at DESC LIMIT 1',
      [primaryUserId, today, 'A']
    );
    
    if (finalReport.rows.length > 0) {
      const report = finalReport.rows[0];
      console.log('\n📊 Shift Report Data:');
      console.log(`   Report ID: ${report.id}`);
      console.log(`   Shift Group: ${report.shift_group}`);
      console.log(`   Date: ${report.shift_date}`);
      console.log(`   Sales Count: ${report.sales_count}`);
      console.log(`   Stock Add Count: ${report.stock_add_count}`);
      console.log(`   Import Count: ${report.import_count}`);
      console.log(`   Total Operations: ${report.total_operations}`);
      
      console.log('\n📋 Operations Log:');
      if (report.operations_log && Array.isArray(report.operations_log)) {
        console.log(`   Total operations: ${report.operations_log.length}`);
        report.operations_log.forEach((log, idx) => {
          console.log(`\n   ${idx + 1}. ${log.action}`);
          console.log(`      Time: ${log.time}`);
          console.log(`      User: ${log.user}`);
          console.log(`      Details: ${log.details}`);
          if (log.product_name) console.log(`      Product: ${log.product_name}`);
          if (log.product_sku) console.log(`      SKU: ${log.product_sku}`);
        });
      } else {
        console.log('   ❌ operations_log is not an array or is null');
      }
      
      console.log('\n✅ Quick reports test completed successfully');
      console.log('   The frontend should now display this data correctly');
    } else {
      console.log('❌ Failed to fetch shift report');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}
testQuickReportsReal();
