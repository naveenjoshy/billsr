# Product Requirements Document (PRD) v3.0
## Daily Collection Management System

---

## 1. Executive Summary
The Daily Collection Management System is a comprehensive financial tool designed for banks to streamline field collections and withdrawals. It bridges the gap between banks, field collection agents, and customers. Version 3.0 upgrades the platform from a simple collection tracker to a robust financial management system featuring stringent agent risk management workflows, scheme-based receipt configurations, dual-directional transactions (deposits and withdrawals), and rigorous audit trails.

## 2. Stakeholders & System Modules
*   **Module 1: The Bank (Admin):** Manages branches, agents, schemes, and compliance parameters. Responsible for resolving pending transaction cancellations and tracking operations against their active software license expiry.
*   **Module 2: The Collection Agent (Field User):** Operates the mobile application for customer onboarding, recording deposits/withdrawals, and issuing scheme-specific thermal receipts. Bound by strict cash-in-hand limits and daily settlement targets.
*   **Module 3: The Customer (End User):** Shop owners/vendors with predefined monthly financial targets. Identified via QR-code and geo-location for secure, on-site daily transactions.

## 3. Core Functional Requirements

### 3.1 Authentication, Onboarding & Compliance
*   **Bank Compliance Tracking:** Bank operations are tied to a license expiry date. Scheduled jobs automatically suspend operational access post-expiry.
*   **Agent Management:** Agents authenticate securely with a mandatory password reset on first login. To mitigate risk, agents are assigned strict cash-in-hand limits (amount and duration). The system issues automated alerts and initiates a settlement lockout if these thresholds are exceeded.
*   **Customer Onboarding:** Agents onboard customers, automatically generating a unique ID and QR code. Agents must capture the shop's exact geo-location (Lat/Long) and a verification photo.

### 3.2 Scheme-Based Financial Operations
*   **Deposits & Withdrawals:** Agents can process both deposits (D) and withdrawals (W). The mobile app requires offline/online balance verification before authorizing any withdrawal.
*   **Bank Schemes:** Financial products (Loans, MBS, RD, Savings) are managed as distinct schemes rather than hardcoded categories, ensuring tight referential integrity.

### 3.3 Dynamic Thermal Printing
*   **Scheme-Based Configurations:** Receipt layouts are standardized at the scheme level to ensure institutional consistency. The application fetches JSON-based configuration payloads to determine the fields to render on Bluetooth thermal printers.

### 3.4 Streamlined Cancellation Workflow
*   **Cancellations** are managed directly in the central transaction ledger. Agents flag a transaction as 'Pending' (P) cancellation and provide a reason. The Bank Admin reviews the request, transitioning the state to 'Cancelled' (C) or keeping it 'Accepted' (A), logging the administrative ID for auditing.

---

## 4. Database Design (Relational Schema)

### 1. `tbl_mt_banks`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `bank_id` | UUID / INT (PK) | Unique identifier for the bank |
| `bank_name` | VARCHAR(150) | Name of the financial institution |
| `address` | TEXT | Registered bank address |
| `email` | VARCHAR(100) | Contact email |
| `phone` | VARCHAR(15) | Primary contact number |
| `password_hash` | VARCHAR(255) | Admin login hash |
| `name_ceo` | VARCHAR(100) | Name of the CEO/Director |
| `designation` | VARCHAR(100) | Designation of the primary contact |
| `license_expiery` | DATE | Operational software license expiration |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `created_by` | UUID / INT | User who created the record |
| `modified_at` | TIMESTAMP | Audit modification timestamp |
| `modified_by` | UUID / INT | User who last modified the record |

### 2. `tbl_mt_agents`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `agent_id` | UUID / INT (PK) | Unique agent identifier |
| `bank_id` | UUID / INT (FK) | Associated bank |
| `name` | VARCHAR(100) | Agent's full name |
| `address` | TEXT | Agent's address |
| `phone_no` | VARCHAR(15) | Agent mobile number for login |
| `email` | VARCHAR(100) | Agent email |
| `password_reset_flag` | BOOLEAN | Forces reset on first login |
| `last_password_change_date`| TIMESTAMP | Security tracking for rotations |
| `cah_holding_limit` | DECIMAL(10,2) | Maximum allowed cash in hand |
| `cash_holding_days` | INT | Maximum days without settlement |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `created_by` | UUID / INT | User who created the record |
| `modified_at` | TIMESTAMP | Audit modification timestamp |
| `modified_by` | UUID / INT | User who last modified the record |

### 3. `tbl_mt_schemes`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `scheme_id` | UUID / INT (PK) | Unique scheme identifier |
| `bank_id` | UUID / INT (FK) | Associated bank |
| `scheme_name` | VARCHAR(100) | Name of the scheme (e.g., MBS) |
| `scheme_description` | TEXT | Details of the financial product |
| `status` | CHAR(1) | 'A' for Active, 'S' for Suspended |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `created_by` | UUID / INT | User who created the record |
| `modified_at` | TIMESTAMP | Audit modification timestamp |
| `modified_by` | UUID / INT | User who last modified the record |

### 4. `tbl_mt_customer`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `customer_id` | INT (PK) | Unique customer ID |
| `agent_id` | UUID / INT (FK) | Acquiring agent |
| `bank_id` | UUID / INT (FK) | Associated bank |
| `type` | VARCHAR(50) | Customer category/type |
| `name` | VARCHAR(100) | Customer name |
| `address` | TEXT | Customer address |
| `phone` | VARCHAR(15) | Customer mobile number |
| `email` | VARCHAR(100) | Customer email |
| `shop_name` | VARCHAR(150) | Business/shop name |
| `shop_lat` | DECIMAL(10,8) | GPS Latitude of the shop |
| `shop_long` | DECIMAL(11,8) | GPS Longitude of the shop |
| `monthly_target` | DECIMAL(10,2) | Required monthly collection amount |
| `qr_code_url` | TEXT | Path/URL to generated QR asset |
| `shop_photo_url` | TEXT | Cloud storage path to shop photo |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `created_by` | UUID / INT | User who created the record |
| `modified_at` | TIMESTAMP | Audit modification timestamp |
| `modified_by` | UUID / INT | User who last modified the record |

### 5. `tbl_mt_parameters`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `param_id` | UUID / INT (PK) | Unique parameter ID |
| `bank_id` | UUID / INT (FK) | Associated bank |
| `parameter_name` | VARCHAR(100) | Name of parameter |
| `parameter_code` | VARCHAR(50) | System code for parameter |
| `parameter_description`| TEXT | Description of usage |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `created_by` | UUID / INT | User who created the record |
| `modified_at` | TIMESTAMP | Audit modification timestamp |
| `modified_by` | UUID / INT | User who last modified the record |

### 6. `tbl_cf_receiptconfig`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `receipt_id` | UUID / INT (PK) | Unique receipt config ID |
| `bank_id` | UUID / INT (FK) | Associated bank |
| `scheme_id` | UUID / INT (FK) | Associated scheme |
| `fields` | JSON | Standard JSON struct for dynamic fields |
| `created_at` | TIMESTAMP | Audit creation timestamp |
| `modified_at` | TIMESTAMP | Audit modification timestamp |

### 7. `tbl_tt_transact`
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `transact_id` | UUID / INT (PK) | Unique transaction ID |
| `receipt_no` | VARCHAR(50) | Alphanumeric receipt number |
| `customer_id` | INT (FK) | Target customer |
| `agent_id` | UUID / INT (FK) | Collecting agent |
| `scheme_id` | UUID / INT (FK) | Referencing tbl_mt_schemes |
| `transact_amt` | DECIMAL(10,2) | Amount collected/withdrawn |
| `transact_type` | CHAR(1) | 'D' for Deposit, 'W' for Withdrawal |
| `transaction_status` | CHAR(1) | 'A' Accepted, 'C' Cancelled, 'P' Pending |
| `transact_mode` | CHAR(1) | 'C' for Cash, 'T' for Transfer/UPI |
| `opening_bal` | DECIMAL(10,2) | Balance prior to transaction |
| `new_balance` | DECIMAL(10,2) | Balance post-transaction |
| `cancellation_reason`| TEXT | Reason provided if status is C or P |
| `reviewed_by` | UUID / INT | Bank Admin ID who approved cancellation |
| `collect_date` | TIMESTAMP | Date and time of transaction |
