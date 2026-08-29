const http = require('http');

const data = [];
for (let i = 1; i <= 35; i++) {
  data.push({
    name: `Product ${i}`,
    sku: `SKU-${Date.now()}-${i}`,
    retail_type: 'retail',
    pieces_per_carton: 1,
    unit_price: i * 10,
    stock_pieces: i * 5,
    unit_kind: 'piece',
    cost_price: i * 5,
    low_stock_alert: 10
  });
}

const postData = JSON.stringify(data);

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/api/inventory/products/batch',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': 'Bearer c905d8d6-dcbd-4414-8214-7300ff6c7552'
  }
};

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers: ${JSON.stringify(res.headers)}`);
  
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  
  res.on('end', () => {
    console.log('Response:', body);
    
    // Now try to get products
    const getOptions = {
      hostname: 'localhost',
      port: 4000,
      path: '/api/inventory/products',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer c905d8d6-dcbd-4414-8214-7300ff6c7552'
      }
    };
    
    const getReq = http.request(getOptions, (getRes) => {
      console.log(`\nGET Status: ${getRes.statusCode}`);
      let getBody = '';
      getRes.on('data', (chunk) => { getBody += chunk; });
      getRes.on('end', () => {
        console.log('GET Response:', getBody);
        const response = JSON.parse(getBody);
        console.log(`\nTotal products fetched: ${response.products?.length || 0}`);
        process.exit(0);
      });
    });
    
    getReq.on('error', (e) => {
      console.error('GET Error:', e.message);
      process.exit(1);
    });
    
    getReq.end();
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
  process.exit(1);
});

req.write(postData);
req.end();
