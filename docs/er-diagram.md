# HireD – Entity Relationship Diagram

## PostgreSQL Database ER Diagram

The following ER diagram represents the database structure documented in `database.md`.

```mermaid
erDiagram

    USERS {
        uuid id PK
        uuid company_id FK
        varchar email UK
        text password_hash
        varchar role
        varchar first_name
        varchar last_name
        varchar phone
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANIES {
        uuid id PK
        varchar name UK
        varchar contact_person
        varchar contact_email
        varchar contact_phone
        text address_line_1
        text address_line_2
        varchar city
        varchar state
        varchar postal_code
        varchar country
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }

    COMPANY_PAYOUT_RATES {
        uuid id PK
        uuid company_id FK
        numeric driver_percentage
        numeric company_percentage
        timestamptz effective_from
        timestamptz effective_until
        uuid created_by FK
        timestamptz created_at
    }

    DRIVERS {
        uuid id PK
        uuid user_id FK
        varchar driver_code UK
        date date_of_birth
        text address
        varchar emergency_contact_name
        varchar emergency_contact_phone
        text selfie_url
        varchar status
        boolean is_online
        timestamptz activated_at
        timestamptz created_at
        timestamptz updated_at
    }

    DRIVER_DOCUMENTS {
        uuid id PK
        uuid driver_id FK
        varchar document_type
        varchar document_number
        text file_url
        varchar mime_type
        bigint file_size
        boolean is_current
        timestamptz uploaded_at
    }

    DRIVER_AVAILABILITY {
        uuid id PK
        uuid driver_id FK
        date availability_date
        boolean is_available
        timestamptz created_at
        timestamptz updated_at
    }

    ORDERS {
        uuid id PK
        varchar order_number UK
        uuid company_id FK
        uuid created_by_user_id FK
        varchar source
        text pickup_location
        numeric pickup_latitude
        numeric pickup_longitude
        text drop_location
        numeric drop_latitude
        numeric drop_longitude
        timestamptz scheduled_at
        varchar vehicle_type
        text service_notes
        varchar contact_name
        varchar contact_phone
        varchar status
        timestamptz created_at
        timestamptz updated_at
    }

    TRIPS {
        uuid id PK
        varchar trip_number UK
        uuid order_id FK
        uuid driver_id FK
        numeric trip_amount
        integer estimated_duration_minutes
        numeric estimated_distance_km
        varchar eta_source
        integer eta_override_minutes
        varchar status
        boolean selfie_required
        timestamptz started_at
        timestamptz closed_at
        timestamptz created_at
        timestamptz updated_at
    }

    TRIP_ASSIGNMENTS {
        uuid id PK
        uuid trip_id FK
        uuid driver_id FK
        uuid assigned_by FK
        timestamptz assigned_at
        timestamptz unassigned_at
        boolean is_current
    }

    TRIP_SELFIES {
        uuid id PK
        uuid trip_id FK
        uuid driver_id FK
        text file_url
        timestamptz captured_at
    }

    TRIP_EXPENSES {
        uuid id PK
        uuid trip_id FK
        uuid driver_id FK
        numeric amount
        text description
        varchar expense_type
        timestamptz created_at
    }

    TRIP_OTPS {
        uuid id PK
        uuid trip_id FK
        text otp_hash
        timestamptz generated_at
        timestamptz expires_at
        timestamptz verified_at
        integer attempts
        boolean is_verified
    }

    TRIP_PAYROLL_RECORDS {
        uuid id PK
        uuid trip_id FK
        uuid company_id FK
        uuid driver_id FK
        numeric trip_amount
        numeric driver_percentage
        numeric company_percentage
        numeric driver_share
        numeric company_share
        numeric total_amount
        varchar payment_status
        varchar payout_status
        uuid wallet_transaction_id FK
        timestamptz calculated_at
    }

    DRIVER_WALLETS {
        uuid id PK
        uuid driver_id FK
        numeric balance
        timestamptz created_at
        timestamptz updated_at
    }

    WALLET_TRANSACTIONS {
        uuid id PK
        uuid wallet_id FK
        uuid driver_id FK
        uuid trip_id FK
        varchar transaction_type
        numeric amount
        numeric balance_before
        numeric balance_after
        varchar reference
        timestamptz created_at
    }

    STATEMENTS {
        uuid id PK
        varchar statement_number UK
        uuid company_id FK
        date period_start
        date period_end
        numeric total_trip_amount
        numeric total_driver_share
        numeric total_company_share
        varchar status
        uuid created_by FK
        timestamptz created_at
        timestamptz verified_at
        timestamptz published_at
    }

    STATEMENT_ITEMS {
        uuid id PK
        uuid statement_id FK
        uuid trip_id FK
        numeric trip_amount
        numeric driver_percentage
        numeric company_percentage
        numeric driver_share
        numeric company_share
    }

    STATEMENT_VERIFICATIONS {
        uuid id PK
        uuid statement_id FK
        uuid admin_id FK
        varchar verification_type
        timestamptz verified_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        varchar notification_type
        varchar title
        text message
        varchar related_entity_type
        uuid related_entity_id
        varchar channel
        varchar status
        timestamptz sent_at
        timestamptz created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid actor_user_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb previous_value
        jsonb new_value
        inet ip_address
        timestamptz created_at
    }

    COMPANIES ||--o{ USERS : has
    COMPANIES ||--o{ COMPANY_PAYOUT_RATES : has
    USERS ||--o| DRIVERS : owns

    DRIVERS ||--o{ DRIVER_DOCUMENTS : has
    DRIVERS ||--o{ DRIVER_AVAILABILITY : has

    COMPANIES ||--o{ ORDERS : receives
    USERS ||--o{ ORDERS : creates
    ORDERS ||--o| TRIPS : becomes

    TRIPS ||--o{ TRIP_ASSIGNMENTS : has
    DRIVERS ||--o{ TRIP_ASSIGNMENTS : receives
    TRIPS ||--o{ TRIP_SELFIES : has
    DRIVERS ||--o{ TRIP_SELFIES : uploads
    TRIPS ||--o{ TRIP_EXPENSES : contains
    DRIVERS ||--o{ TRIP_EXPENSES : records
    TRIPS ||--o| TRIP_OTPS : uses

    TRIPS ||--o| TRIP_PAYROLL_RECORDS : generates
    COMPANIES ||--o{ TRIP_PAYROLL_RECORDS : funds
    DRIVERS ||--o{ TRIP_PAYROLL_RECORDS : earns

    DRIVERS ||--|| DRIVER_WALLETS : owns
    DRIVER_WALLETS ||--o{ WALLET_TRANSACTIONS : contains
    TRIPS ||--o| WALLET_TRANSACTIONS : creates

    COMPANIES ||--o{ STATEMENTS : receives
    STATEMENTS ||--o{ STATEMENT_ITEMS : contains
    TRIPS ||--o{ STATEMENT_ITEMS : included_in
    STATEMENTS ||--o{ STATEMENT_VERIFICATIONS : requires
    USERS ||--o{ STATEMENT_VERIFICATIONS : performs

    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ AUDIT_LOGS : creates
```

## Core workflow

`Company → Order → Trip → Assignment → Expenses/OTP → Payroll → Wallet → Statement → Verification`

The diagram intentionally does not model a direct Company → Driver ownership relationship. Drivers are associated with trips/assignments, while payout rates are company-level.
