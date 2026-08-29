# 2SLASH4 Business Platform

React + Vite reproduction of the existing Google Apps Script dashboard. Chart.js is used through `react-chartjs-2`; all business values come from one cached Apps Script JSON request.

## Run

1. `.env.local` contains the deployed `VITE_GAS_API_URL`.
2. Merge the API routing branch from `apps-script/Code.gs.example` into the existing Apps Script `doGet(e)`, then create a new deployment.
3. Run `npm install`, then `npm run dev`.

All Apps Script communication is centralized in `src/lib/api.ts`. It requests the five datasets once per selected month in parallel and caches each response in memory. Apps Script caches each dataset/month for ten minutes using `CacheService`.
