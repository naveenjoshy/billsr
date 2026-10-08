# Technical Requirements Document (TRD)
## Daily Collection Management System v3.0

---

## 1. Introduction

### 1.1 Purpose
This document outlines the technical architecture, technology stack, and engineering requirements for building the Daily Collection Management System v3.0. It serves as a blueprint for the development team to ensure the system is scalable, secure, and meets the business objectives defined in the PRD.

### 1.2 Scope
The system comprises three primary interfaces:
1.  **Web Admin Portal:** A React-based dashboard for Bank Administrators.
2.  **Mobile Agent Application:** A React Native mobile application for Field Collection Agents.
3.  **Backend API & Database:** A Node.js/Express REST API communicating with a MongoDB database, serving both the web and mobile interfaces.

---

## 2. Technology Stack (MERN+)

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Database** | MongoDB (Atlas) | Flexible schema design, robust geospatial querying (GeoJSON) for shop locations, and high scalability for transaction volume. |
| **Backend Framework** | Node.js with Express.js | Lightweight, non-blocking I/O ideal for handling numerous concurrent API requests from field agents. |
| **Web Frontend** | React.js (Vite) | Component-based architecture for building a responsive, state-managed Admin dashboard. |
| **Mobile Frontend** | React Native (Expo/Bare) | Cross-platform (iOS/Android) development using a single JavaScript codebase, crucial for agent device diversity. |
| **State Management**| Redux Toolkit or Zustand | Predictable state container for managing complex UI states (e.g., transaction workflows, auth). |
| **Authentication** | JWT (JSON Web Tokens) | Stateless, scalable authentication mechanism for securing APIs. |
| **Styling (Web)** | Tailwind CSS | Utility-first CSS framework for rapid UI development and consistent design system implementation. |
| **Styling (Mobile)**| StyleSheet / NativeWind | Performant styling for React Native components. |

---

## 3. System Architecture

The system follows a standard Client-Server architecture utilizing a RESTful API.

### 3.1 High-Level Architecture Diagram
*(Conceptual)*
*   **Clients:** Web Browser (Admin), Mobile App (Agent) -> communicate via HTTPS -> **API Gateway / Load Balancer** -> **Node.js/Express Backend** -> communicates via Mongoose -> **MongoDB Database**.

### 3.2 Mobile App (Agent) Specifics
*   **Offline Capability:** Requires local storage (e.g., AsyncStorage or SQLite) to queue transactions if the network drops, syncing when reconnected. *Note: As per PRD, withdrawals require strict online balance verification, so offline withdrawals may need specific business logic handling (e.g., disabled or highly restricted).*
*   **Hardware Integration:**
    *   **Camera:** For capturing customer shop verification photos.
    *   **GPS:** To capture exact Lat/Long coordinates during onboarding.
    *   **Bluetooth:** To communicate with external thermal printers for dynamic receipt generation.

---

## 4. Backend Architecture & API Design

### 4.1 RESTful API Principles
*   Base URL: `/api/v1/`
*   Use standard HTTP methods (`GET`, `POST`, `PUT`, `DELETE`).
*   Return standard HTTP status codes (200, 201, 400, 401, 403, 404, 500).
*   All requests/responses should be in `application/json`.

### 4.2 Core Endpoints (Summary)
*(Refer to `api_endpoints.md` for full details)*
*   `/auth/*`: Login, password reset workflows.
*   `/customers/*`: Onboarding, fetching customer details.
*   `/transactions/*`: Recording deposits/withdrawals, requesting cancellations, admin reviews.
*   `/receipts/*`: Fetching dynamic scheme configurations.

### 4.3 Database Interactions (Mongoose)
*   Use Mongoose ODM for schema validation, strict typing (within JS limits), and middleware hooks (e.g., updating timestamps `modified_at` on save).
*   Implement transaction handling (MongoDB Transactions) for critical operations (e.g., recording a withdrawal and updating the customer balance simultaneously) to ensure atomicity.

---

## 5. Security & Compliance

### 5.1 Authentication & Authorization
*   **JWT:** Issued upon successful login, containing user role and ID. Must be included in the `Authorization: Bearer <token>` header of subsequent requests.
*   **Role-Based Access Control (RBAC):** Middleware in Express to protect routes (e.g., only `admin` can hit `/transactions/*/review`).
*   **Password Hashing:** Use `bcryptjs` to hash passwords before storing them in the database. Never store plain-text passwords.

### 5.2 Data Protection
*   **In Transit:** All API traffic must be over HTTPS/TLS.
*   **At Rest:** Utilize MongoDB Atlas encryption at rest.

### 5.3 Agent Risk Management (Business Logic Security)
*   **Cash-in-Hand Limits:** Backend middleware must intercept transaction requests and verify the agent's current held cash against their `cah_holding_limit`. If exceeded, reject the transaction with a specific error code.
*   **First Login Reset:** Backend must enforce the `password_reset_flag` before allowing access to operational endpoints.

---

## 6. Deployment & DevOps Strategy

### 6.1 Environments
*   **Development:** Local machines, local MongoDB.
*   **Staging:** Cloud-hosted environment mimicking production for QA testing.
*   **Production:** Highly available, scalable cloud infrastructure.

### 6.2 Hosting Recommendations
*   **Database:** MongoDB Atlas (Managed service for automated backups, scaling, and security).
*   **Backend:** AWS (EC2/ECS), Google Cloud Run, or Heroku.
*   **Web Frontend:** Vercel, Netlify, or AWS S3 + CloudFront.

### 6.3 CI/CD
*   Implement GitHub Actions or GitLab CI to automate testing (Jest for backend/frontend unit tests) and deployment pipelines.

---

## 7. Performance & Scalability Considerations

*   **Database Indexing:** Crucial for query performance. Implement indexes as defined in `mongodb_schema_design.md` (e.g., spatial index for location, compound indexes for transaction lookups).
*   **Pagination:** Implement limit/offset or cursor-based pagination on list endpoints (e.g., fetching transaction history) to prevent payload bloat.
*   **Asset Storage:** Shop photos should be uploaded directly to a CDN or cloud storage (e.g., AWS S3, Cloudinary) and only the URL saved in MongoDB. Do not store Base64 images in the database.