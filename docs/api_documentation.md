# API Documentation: Daily Collection Management System

## 1. Customer Onboarding

*   **Method:** `POST`
*   **Endpoint:** `/api/v1/customers/onboard`
*   **Description:** Onboards a new shop owner or vendor. The system automatically generates a unique customer ID and returns a QR code URL for future rapid identification.
*   **Key Data Captured:** Customer details, shop latitude (`shop_lat`), shop longitude (`shop_long`), and a cloud storage reference for the verification photo (`shop_photo_url`).
*   **Response:** Returns the generated `customer_id`, `qr_code_url`, and success status.

## 2. Financial Operations (Collections & Withdrawals)

### 2.1 Record Daily Collection (Deposit)

*   **Method:** `POST`
*   **Endpoint:** `/api/v1/transactions/collection`
*   **Description:** Records a daily collection (deposit) from a customer. This increases the customer's balance for the specific scheme.
*   **Request Payload:** 
    ```json
    {
      "customer_id": "string",
      "scheme_id": "string",
      "transact_amt": "number",
      "transact_mode": "string" // "Cash" or "UPI"
    }
    ```
*   **Response:** Returns the updated `new_balance`, a unique `transaction_id`, and a generated `receipt_no`.

### 2.2 Process Customer Withdrawal

*   **Method:** `POST`
*   **Endpoint:** `/api/v1/transactions/withdrawal`
*   **Description:** Processes a withdrawal request from a customer. The backend performs a strict offline/online balance verification to ensure sufficient funds exist before authorizing the withdrawal.
*   **Request Payload:** 
    ```json
    {
      "customer_id": "string",
      "scheme_id": "string",
      "transact_amt": "number",
      "transact_mode": "string" // "Cash" or "UPI"
    }
    ```
*   **Response:** Returns the updated `new_balance`, a unique `transaction_id`, and a generated `receipt_no`. Returns a `400 Bad Request` if insufficient funds.

## 3. Dynamic Thermal Printing

### 3.1 Fetch Scheme Receipt Configuration

*   **Method:** `GET`
*   **Endpoint:** `/api/v1/receipts/config/{scheme_id}`
*   **Description:** Retrieves the dynamic JSON configuration payload standard for the specified financial scheme. The mobile application parses this payload to correctly format and render text on Bluetooth thermal printers.
*   **Response:** Returns a JSON object containing field mappings, headers, footers, and required variable keys (e.g., `customer_name`, `collected_amount`, `balance`).

## 4. Cancellation Workflow

### 4.1 Flag Transaction for Cancellation (Agent Request)

*   **Method:** `POST`
*   **Endpoint:** `/api/v1/transactions/{transact_id}/cancel-request`
*   **Description:** Allows an agent to request a cancellation for a mistakenly entered transaction. This endpoint updates the transaction's status to Pending (`P`) in the central ledger and stores the agent's provided reason.
*   **Request Payload:** 
    ```json
    { 
      "cancellation_reason": "string" 
    }
    ```
*   **Response:** Returns an updated transaction status.

### 4.2 Review Cancellation Request (Bank Admin)

*   **Method:** `PUT`
*   **Endpoint:** `/api/v1/transactions/{transact_id}/review`
*   **Description:** Used by the Bank Administrator via the web portal to review pending cancellation requests. The admin can either approve (changing status to Cancelled - `C`) or reject (reverting status to Accepted - `A`). The system logs the `reviewed_by` ID for audit trails.
*   **Request Payload:** 
    ```json
    { 
      "action": "APPROVE" | "REJECT", 
      "admin_notes": "string" 
    }
    ```
*   **Response:** Returns the final resolved status of the transaction.