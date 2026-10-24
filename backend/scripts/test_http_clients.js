const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-replace-in-production-min256bit';
const token = jwt.sign(
  {
    id: '1f2465dc-9c9b-4d09-a5fa-24c019be87d6',
    email: 'ayomidenoch15@gmail.com',
    role: 'super-admin',
    full_name: 'Olugbodi Ayomide'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/registered-clients',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
}, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      console.log('HTTP GET /api/admin/registered-clients Status:', res.statusCode);
      console.log('Total registered clients:', data.count);
      if (data.data && data.data.length > 0) {
        data.data.slice(0, 5).forEach(c => {
          console.log(` -> ${c.organization_name} (${c.facility_code}) | ${c.full_name} | ${c.email} | Requests: ${c.total_requests_count}`);
        });
      }
      process.exit(0);
    } catch (e) {
      console.error('Failed to parse response:', body);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('HTTP Request error:', e.message);
  process.exit(1);
});

req.end();
