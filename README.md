# Billsr — Daily Collection Management System

Billsr is a financial operations platform engineered for banks, co-operative credit societies, and micro-finance institutions. It automates and streamlines daily field collections (Pigmy / Daily Deposit schemes), manages collection agents, enforces cash-in-hand limits, and provides real-time transaction reconciliation with thermal receipt printing.

---

## Key Capabilities

### 1. Multi-Tenant Role-Based Access Control (RBAC)
- **Super Admin (Developer)**: Centralized institution onboarding, license expiration tracking, renewal grace period grants, and automated or manual bank suspensions.
- **Bank Admin**: Branch & field agent onboarding, collection schemes configuration, thermal receipt template design, transaction ledger monitoring, cash limit thresholds, and cancellation request dispute resolution.
- **Collection Agent (Field User)**: Field collection portal, real-time customer deposits and withdrawals, cash-in-hand settlement tracking, and Bluetooth thermal receipt generation.
- **Customer**: Multi-scheme account mapping, KYC verification (photo and ID verification), and verified collection receipts.

### 2. Scheme & Receipt Configuration
- Supports multi-scheme mappings (e.g., Daily Pigmy, Recurring Deposits, Loan collections).
- Scheme-level Bluetooth thermal receipt formatting via customizable JSON payloads.

### 3. Financial Transaction Forensics & Ledger
- Dual-directional transaction processing (deposits and withdrawals).
- Granular transaction audit trail tracking state changes, cancellation requests, and approvals.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, Vanilla CSS Design System, Responsive Modals |
| **Backend** | Node.js (ES Modules), Express 5, Mongoose 8, Morgan, CORS |
| **Database** | MongoDB (Local or MongoDB Atlas) |
| **Security** | JWT (Access Tokens + httpOnly Refresh Cookies), bcryptjs, express-rate-limit |
| **Monorepo** | npm Workspaces, Concurrently |

---

## Project Structure

```text
.
├── backend/
│   ├── config/             # Database connection & runtime configurations
│   ├── constants/          # HTTP status codes & constants
│   ├── controllers/        # Request handlers (auth, admin, bank, agent)
│   ├── middleware/         # RBAC, JWT verification, payload validators
│   ├── models/             # Mongoose schemas (User, Bank, Agent, Scheme, Transaction, AuditLog)
│   ├── routes/             # Express API routing modules
│   ├── scripts/            # Database seed and maintenance utilities
│   ├── server.js           # Server bootstrap and graceful shutdown
│   ├── app.js              # Express app definition
│   └── .env.example        # Environment variables template
├── docs/                   # Engineering specifications, PRD, TRD, and schemas
│   ├── Bank_Collection_PRD_v3.md
│   ├── technical_requirements_document_trd.md
│   ├── api_documentation.md
│   ├── mongodb_er_schema_design.md
│   └── er-diagram.md
├── frontend/
│   ├── public/             # Static assets & SVG icons
│   ├── src/                # React pages, components, services, and styles
│   ├── index.html          # Vite HTML entry point
│   └── package.json
├── eslint.config.js        # Workspace linter configuration
├── vite.config.js          # Vite config with API proxy
└── package.json            # Monorepo workspaces & concurrent scripts
```

---

## Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: A running local MongoDB instance or MongoDB Atlas connection URI

### 1. Installation

Install all dependencies across the workspace from the project root:

```sh
npm install
```

*(Alternatively, you can install individually: `npm --prefix backend install` and `npm --prefix frontend install`)*

### 2. Environment Configuration

Create a `.env` (or `.env.local`) file inside the `backend/` directory:

```sh
cp backend/.env.example backend/.env
```

Configure your environment variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/billsr
MONGODB_DB=billsr

# Authentication & Security
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_here
```

> **Note:** The Vite frontend development server proxies `/api` requests to `http://localhost:3000` by default (defined in `vite.config.js`).

### 3. Database Seeding (Optional)

To seed initial schemes, sample banks, and transaction data into your MongoDB database:

```sh
npm run seed
```

### 4. Running the Application

From the root directory, start both the backend API and frontend development server concurrently:

```sh
npm run dev
```

You can also start them independently in separate terminal windows:

- **Start Backend API only**:
  ```sh
  npm run server
  # or: npm run dev:api
  ```
- **Start Frontend only**:
  ```sh
  npm run client
  ```

Access the applications in your browser:
- **Frontend App**: `http://localhost:5173`
- **Backend API & Health Check**: `http://localhost:3000/health`

---

## Build & Production Deployment

To generate an optimized production build of the frontend:

```sh
npm run build
```

To run code quality and linting checks:

```sh
npm run lint
```

To launch the production server:

```sh
npm start
```

---

## Core API Endpoints

| Method | Endpoint | Access Role | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | Server and MongoDB connection status |
| `POST` | `/api/auth/login` | Public | Authenticates credentials and returns JWT session |
| `POST` | `/api/auth/refresh` | Public | Refreshes access token via httpOnly cookie |
| `GET` | `/api/auth/me` | Authenticated | Fetches profile of current session user |
| `POST` | `/api/auth/logout` | Authenticated | Clears authentication tokens |
| `GET` | `/api/admin/banks` | Superadmin | Lists all onboarded financial institutions |
| `POST` | `/api/admin/banks` | Superadmin | Onboards a new bank & provisions Bank Admin |
| `POST` | `/api/admin/banks/:id/extend` | Superadmin | Extends software license validity |
| `POST` | `/api/admin/banks/:id/suspension` | Superadmin | Toggles bank operational suspension status |
| `GET` | `/api/bank/dashboard` | Bank Admin | Bank overview metrics and collection status |
| `GET` | `/api/bank/agents` | Bank Admin | Lists all bank agents and cash limits |
| `POST` | `/api/bank/agents` | Bank Admin | Creates and provisions a new collection agent |
| `GET` | `/api/bank/schemes` | Bank Admin | Lists deposit schemes and receipt configs |
| `POST` | `/api/bank/schemes` | Bank Admin | Registers a new collection scheme |
| `GET` | `/api/bank/transactions` | Bank Admin | Transaction forensic ledger and history |
| `POST` | `/api/bank/transactions/:id/cancel` | Bank Admin | Approves or submits transaction cancellation |
| `GET` | `/api/agent/home` | Agent | Agent field dashboard and collection summary |

For exhaustive schema definitions and request/response contracts, consult the [API Documentation](docs/api_documentation.md).

---

## Architecture & Specifications

For comprehensive product specifications and engineering diagrams, explore the `docs/` directory:
- [Product Requirements Document (PRD)](docs/Bank_Collection_PRD_v3.md)
- [Technical Requirements Document (TRD)](docs/technical_requirements_document_trd.md)
- [API Documentation](docs/api_documentation.md)
- [MongoDB ER & Schema Design](docs/mongodb_er_schema_design.md)
- [Entity-Relationship Diagram](docs/er-diagram.md)

---

## License

ISC License © [Naveen Joshy](https://github.com/naveenjoshy)
