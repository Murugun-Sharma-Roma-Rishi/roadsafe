// app/config.example.js
// Copy this file to config.js and fill in your values

const DEV_IP = 'YOUR_LOCAL_IP_HERE'; // run "ipconfig" to find it

const config = {
  API_URL: `http://${DEV_IP}:3001`,
  APP_NAME: 'RoadSafe Mauritius',
  VERSION: '1.0.0',
};

export default config;