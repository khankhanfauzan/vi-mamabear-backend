import http from 'k6/http';
import { sleep } from 'k6';

export const options = {

    // Load pattern for startup baseline

    stages: [

      { duration: "30s", target: 50 },  // Ramp-up to 50 users

      { duration: "2m", target: 50 },   // Stay at 50 users

      { duration: "30s", target: 0 },   // Ramp-down to 0

    ],

  

    // Pass/Fail criteria

    thresholds: {

      http_req_duration: ["p(95)<500"], // 95% requests < 500ms

      http_req_failed: ["rate<0.01"],   // Less than 1% errors

    },

};

export default function () {
  http.get('https://mamabear-backend-production.up.railway.app/products/1');
  sleep(1);
}   
