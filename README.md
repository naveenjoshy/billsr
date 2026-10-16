# Billsr

Billsr is organized as a React/Vite web client and a separate Express API. The
API uses MongoDB through Mongoose.

## Project structure

```text
.
├── backend/
│   ├── config/             # Environment and database setup
│   ├── controllers/        # HTTP request handlers
│   ├── middleware/         # Shared Express middleware
│   ├── routes/             # API route definitions
│   ├── app.js              # Express application
│   ├── server.js           # Database connection and HTTP startup
│   ├── .env.example
│   └── package.json
├── docs/                   # Product, technical, and API documentation
├── frontend/
│   ├── public/             # Static frontend files
│   ├── src/                # React application, styles, and assets
│   ├── index.html
│   └── package.json
├── eslint.config.js
└── vite.config.js
```

## Local development

Install dependencies in both apps:

```sh
npm --prefix frontend install
npm --prefix backend install
```

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` to a running
MongoDB instance. From the repository root, start the API and frontend in
separate terminals:

```sh
npm run dev:api
npm run dev
```

The API listens on port `3000` by default. The Vite development server proxies
`/api` requests to it. The starter endpoint is `GET /api/health`.

Run frontend checks with `npm run lint` and `npm run build`. Start the backend
for production with `npm --prefix backend start`.
