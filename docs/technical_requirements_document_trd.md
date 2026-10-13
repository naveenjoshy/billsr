# Technical Requirements Document (TRD)
## Daily Collection Management System (v1.0 based on PRD v6.0)

### 1. Introduction
#### 1.1 Purpose
This Technical Requirements Document (TRD) outlines the architectural, structural, and technical specifications required to build the Daily Collection Management System. This document serves as the technical blueprint for developers, DevOps, and QA teams, translating the features from PRD v6.0 into implementable technical guidelines.

#### 1.2 System Overview
The system is a centralized financial platform that bridges Super Admins (Developers), Bank Admins, Field Collection Agents, and End Customers. It facilitates secure, offline-capable field collections, dual-directional transactions (deposits/withdrawals), strict agent risk management, dynamic thermal printing, and comprehensive audit tracking.

---

### 2. System Architecture
The application will follow a multi-tier Client-Server architecture:
*   **Presentation Layer (Client):** 
    *   **Web Portal:** Responsive Single Page Application (SPA) for Super Admins and Bank Admins.
    *   **Mobile Application:** Cross-platform mobile app for Collection Agents optimized for low-latency and offline balance verification.
*   **Application Layer (Backend API):** RESTful / GraphQL API handling business logic, transaction validation, role-based routing, and thermal printer payload generation.
*   **Data Layer (Database):** NoSQL document-based database optimized for high-volume ledger entries and complex hierarchical data (MongoDB).

---

### 3. Proposed Technology Stack
*   **Backend Framework:** Node.js with Express (or NestJS) / Python (FastAPI).
*   **Database:** MongoDB (Atlas or self-hosted) for document-oriented flexibility and horizontal scaling.
*   **Frontend Web (Admin Portal):** React.js or Vue.js with TailwindCSS.
*   **Frontend Mobile (Agent App):** Flutter or React Native (crucial for native Bluetooth thermal printer integrations).
*   **Authentication:** JSON Web Tokens (JWT) with bcrypt for password hashing.
*   **Infrastructure & Hosting:** AWS (EC2, S3 for KYC image storage, CloudWatch for logs) or Google Cloud Platform. Dockerized containers for microservices.
*   **Printing:** Bluetooth ESC/POS protocol handling via mobile native modules.

---

### 4. Database Architecture & Schema implementation
The system utilizes a NoSQL schema optimized for read-heavy operations on customer data and write-heavy operations on transactions and audit logs.

**Core Collections (referencing PRD v6.0 JSON Design):**
1.  **`developers`**: Super Admin credentials and roles.
2.  **`banks`**: Financial institution profiles, compliance statuses, and software license tracking.
3.  **`agents`**: Field operative data, KYC links, and cash-in-hand thresholds.
4.  **`schemes`**: Financial products (MBS, Loans) and JSON-based receipt layouts.
5.  **`customers`**: End-user KYC, Geo-location (GeoJSON), and demographics.
6.  **`customer_schemes`**: Linkage bridging customers to multiple active schemes.
7.  **`transactions`**: Immutable ledger for deposits, withdrawals, and cancellations.
8.  **`audit_logs`**: System-wide state change tracking for compliance.

*Data Integrity Note: While MongoDB is schemaless, Mongoose (or similar ODM) strict schemas MUST be enforced at the application level to maintain referential integrity (using ObjectIds).*

---

### 5. Security & Authentication (RBAC)
#### 5.1 Unified Login & Routing
*   A single `/api/v1/auth/login` endpoint accepts `email` and `password`.
*   The backend verifies credentials and evaluates the user's collection type (Developer, Bank, or Agent).
*   Returns a signed JWT containing `userId`, `role`, and `bankId` (if applicable).
*   The client application decodes the JWT and redirects the user to their respective dashboard.

#### 5.2 License & Compliance Enforcement
*   **Middleware:** A global API middleware intercepts all requests from Bank Admins and Agents. It checks the `license_expiry` and `account_status` of the associated `bank_id`.
*   **Automated CRON Jobs:** A daily backend CRON job evaluates `license_expiry` and `grace_period_end`. It automatically updates `account_status` to 'Suspended' and fires email triggers to the Developer and Bank Admin if limits are exceeded.

#### 5.3 Agent Risk Mitigation
*   Transactions API validates the agent's current aggregated collections against `cash_holding_limit`. If the transaction pushes the agent over the limit, the API returns a `403 Forbidden` (Lockout) until a settlement is recorded.

---

### 6. API Endpoints (Core Modules Overview)

#### 6.1 Authentication
*   `POST /auth/login` - Authenticates user and issues JWT.
*   `POST /auth/reset-password` - Mandatory password change flag handler.

#### 6.2 Developer (Super Admin) API
*   `POST /developer/banks` - Onboards a new bank.
*   `PUT /developer/banks/:id/license` - Updates license expiry and grace periods.
*   `GET /developer/system/audit` - Fetches global audit logs.

#### 6.3 Bank Admin API
*   `POST /bank/agents` - Creates a new agent profile (requires file upload for KYC).
*   `POST /bank/schemes` - Configures new financial schemes and dynamic thermal printing JSON payloads.
*   `PUT /bank/transactions/:id/cancel` - Approves or rejects an agent's pending transaction cancellation.

#### 6.4 Collection Agent (Mobile) API
*   `POST /agent/customers` - Onboards a new customer (captures Lat/Long and uploads shop/ID photos to S3).
*   `POST /agent/transactions` - Records a Deposit (D) or Withdrawal (W). Must include pre-transaction balance validation.
*   `GET /agent/schemes/:id/receipt-config` - Fetches the JSON receipt layout for the thermal printer.

---

### 7. External Integrations & Hardware
*   **Cloud Storage:** Amazon S3 or GCP Cloud Storage for securely storing `customer_photo_url`, `shop_photo_url`, `agent_photo_url`, and `agent_id_url`. Pre-signed URLs should be used for access.
*   **Bluetooth Thermal Printing:** The mobile app fetches the `receipt_config.fields` JSON from the backend. The mobile frontend iterates through this JSON array to dynamically construct the ESC/POS string (text alignment, bolding, line breaks) sent to the paired Bluetooth printer.

---

### 8. System-Wide Audit Logging Strategy
To satisfy PRD v6.0 compliance:
*   **Database Triggers / Middleware:** Every `POST`, `PUT`, `PATCH`, and `DELETE` operation across all primary collections must trigger an asynchronous write to the `audit_logs` collection.
*   **Payload structure:** Must explicitly capture `collection_name`, `document_id`, `changed_field`, `previous_value`, `new_value`, and the `updated_by` (extracted from the JWT).
