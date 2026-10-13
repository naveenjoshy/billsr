# API Documentation: Daily Collection Management System v1.0

## 1. Overview
This RESTful API supports the Daily Collection Management System, facilitating operations for Developers (Super Admins), Bank Admins, and Field Collection Agents. 

**Base URL:** `https://api.collection-system.com/api/v1`

### Authentication & Headers
All protected endpoints require a JSON Web Token (JWT) passed in the `Authorization` header.
*   **Header:** `Authorization: Bearer <token>`
*   **Content-Type:** `application/json` (except for file uploads, which use `multipart/form-data`)

### Standard HTTP Status Codes
*   `200 OK` - Request successful.
*   `201 Created` - Resource successfully created.
*   `400 Bad Request` - Validation error or business logic violation.
*   `401 Unauthorized` - Missing or invalid JWT.
*   `403 Forbidden` - User lacks permissions, or an operational lockout is active (e.g., license expired, cash limit exceeded).
*   `404 Not Found` - Resource does not exist.
*   `500 Internal Server Error` - Unhandled backend failure.

---

## 2. Authentication Endpoints

### 2.1 Login
Authenticate a user (Developer, Bank Admin, or Agent) and return a unified JWT.
*   **Method:** `POST`
*   **Path:** `/auth/login`
*   **Body:**
    ```json
    {
      "email": "user@example.com",
      "password": "securepassword"
    }
    ```
*   **Success Response (200 OK):**
    ```json
    {
      "token": "eyJhbG...",
      "role": "Agent",
      "user": { "id": "uuid", "name": "John Doe", "bank_id": "uuid" },
      "password_reset_required": false
    }
    ```
*   **Edge Cases & Error Handling:**
    *   **401 Unauthorized:** Invalid credentials.
    *   **403 Forbidden (Bank Suspended):** If the user is a Bank Admin or Agent and their associated bank's `license_expiery` or `grace_period_end` has passed. *Error: "Bank operations suspended due to license expiration."*
    *   **403 Forbidden (Agent Lockout):** If an Agent has exceeded their `cash_holding_days` limit without settlement.

---

## 3. Developer (Super Admin) Endpoints

### 3.1 Onboard New Bank
Create a new bank profile and generate their initial Admin account.
*   **Method:** `POST`
*   **Path:** `/developer/banks`
*   **Auth Required:** `Developer`
*   **Body:** `bank_name`, `email`, `phone`, `password`, `license_expiery`
*   **Success Response (201 Created):** Returns the generated Bank Object.
*   **Edge Cases:**
    *   **400 Bad Request:** Email or phone already registered to another bank.
    *   **400 Bad Request:** License expiry date is in the past.

### 3.2 Manage Bank License & Grace Period
Update a bank's operational license or extend a grace period.
*   **Method:** `PUT`
*   **Path:** `/developer/banks/:bank_id/license`
*   **Auth Required:** `Developer`
*   **Body:** 
    ```json
    {
      "license_expiery": "2027-12-31",
      "grace_period_end": "2028-01-15",
      "account_status": "Active"
    }
    ```
*   **Success Response (200 OK):** Updated bank compliance object.
*   **Edge Cases:**
    *   **404 Not Found:** `bank_id` does not exist.
    *   **400 Bad Request:** Transitioning `account_status` to 'Active' while the expiry dates are still in the past.

---

## 4. Bank Admin Endpoints

### 4.1 Onboard Collection Agent
Create a field agent profile with strict cash holding parameters.
*   **Method:** `POST`
*   **Path:** `/bank/agents`
*   **Auth Required:** `Bank Admin`
*   **Body (multipart/form-data):** `name`, `phone_no`, `email`, `cah_holding_limit`, `cash_holding_days`, `agent_photo` (file), `agent_id_image` (file).
*   **Success Response (201 Created):** Agent object including uploaded S3 image URLs.
*   **Edge Cases:**
    *   **403 Forbidden:** The bank's license is expired.
    *   **400 Bad Request:** File uploads exceed size limits or are invalid formats (e.g., PDFs instead of images).

### 4.2 Review Transaction Cancellation
Approve or reject a pending cancellation flagged by an agent.
*   **Method:** `PUT`
*   **Path:** `/bank/transactions/:transact_id/cancel`
*   **Auth Required:** `Bank Admin`
*   **Body:**
    ```json
    {
      "action": "Approve", 
      "review_notes": "Duplicate entry confirmed."
    }
    ```
*   **Success Response (200 OK):** Transaction status updated to `C` (Cancelled). Ledger balances are automatically reversed.
*   **Edge Cases:**
    *   **400 Bad Request:** Transaction is not in 'P' (Pending) status.
    *   **400 Bad Request:** Reversing a deposit would result in a negative `new_balance` for the customer.

---

## 5. Collection Agent (Field User) Endpoints

### 5.1 Onboard Customer
Register a customer and map them to their initial financial scheme.
*   **Method:** `POST`
*   **Path:** `/agent/customers`
*   **Auth Required:** `Agent`
*   **Body:** `name`, `shop_name`, `phone`, `shop_lat`, `shop_long`, `scheme_id`, `schem_opening_amount`, `monthly_target`, `shop_photo_url`.
*   **Success Response (201 Created):** Customer profile, generated QR code URL, and `customer_schemes` mapping.
*   **Edge Cases:**
    *   **400 Bad Request:** `shop_lat` or `shop_long` is missing or out of valid GPS coordinate bounds.
    *   **404 Not Found:** The provided `scheme_id` does not exist or is Suspended ('S').
    *   **403 Forbidden:** The agent's password reset flag is true (must reset password before onboarding).

### 5.2 Process Transaction (Deposit / Withdrawal)
Record a financial transaction on the field.
*   **Method:** `POST`
*   **Path:** `/agent/transactions`
*   **Auth Required:** `Agent`
*   **Body:**
    ```json
    {
      "customer_id": 1054,
      "scheme_id": "uuid-of-scheme",
      "transact_amt": 500.00,
      "transact_type": "D", 
      "transact_mode": "C"
    }
    ```
*   **Success Response (201 Created):**
    ```json
    {
      "receipt_no": "REC-998234",
      "transaction_status": "A",
      "opening_bal": 1000.00,
      "new_balance": 1500.00,
      "collect_date": "2026-10-13T06:35:00Z"
    }
    ```
*   **Edge Cases & Error Handling:**
    *   **403 Forbidden (Agent Cash Limit Exceeded):** If a Deposit (`D`) in Cash (`C`) causes the agent's total unremitted cash to exceed their `cah_holding_limit`. *Error: "Transaction declined. Cash holding limit exceeded. Please settle with the bank."*
    *   **403 Forbidden (Settlement Overdue):** If the agent hasn't settled cash at the bank within their `cash_holding_days` threshold.
    *   **400 Bad Request (Insufficient Funds):** If `transact_type` is `W` (Withdrawal) and `transact_amt` is greater than the customer's current scheme balance.
    *   **400 Bad Request (Scheme Mapping):** The customer is not enrolled in the provided `scheme_id`.
    *   **403 Forbidden (Bank Suspended):** Global middleware catches if the bank's license expired mid-shift.

### 5.3 Fetch Scheme Receipt Configuration
Fetch the JSON payload dictating how the Bluetooth thermal printer should format the receipt.
*   **Method:** `GET`
*   **Path:** `/agent/schemes/:scheme_id/receipt-config`
*   **Auth Required:** `Agent`
*   **Success Response (200 OK):** JSON array of fields (e.g., `field_name`, `print_order`, `is_mandatory`).
*   **Edge Cases:**
    *   **404 Not Found:** Scheme does not exist or has no receipt configuration defined by the Bank Admin.

---

## 6. Audit Trail System (Internal)
*Note: The audit trail is managed automatically via backend middleware. Direct API modification of the audit logs is not permitted by any role.*

*   Every `POST`, `PUT`, `PATCH`, and `DELETE` request triggers a synchronous write to `tbl_sys_audit_trail` (or the `audit_logs` MongoDB collection) detailing the `changed_field`, `previous_value`, `new_value`, and the `user_id` extracted from the JWT token making the request.