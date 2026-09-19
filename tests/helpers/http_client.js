// tests/helpers/http_client.js — HTTP Client for End-to-End API Integration Tests (<500 lines)
const http = require('http');

function createHttpClient(port) {
  return function request(path, method = 'GET', headers = {}, body = null) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      });
      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  };
}

module.exports = { createHttpClient };
