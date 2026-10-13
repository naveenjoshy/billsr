# Entity-Relationship (ER) Diagram
## Daily Collection Management System v6.0

This diagram represents the relational database structure, foreign key mappings, and cardinalities for the system as defined in PRD v6.0.

```mermaid
erDiagram
    %% Core Relationships
    tbl_mt_banks ||--o{ tbl_mt_agents : "employs"
    tbl_mt_banks ||--o{ tbl_mt_schemes : "offers"
    tbl_mt_banks ||--o{ tbl_mt_customer : "governs"
    tbl_mt_banks ||--o{ tbl_cf_receiptconfig : "owns"
    
    tbl_mt_agents ||--o{ tbl_mt_customer : "onboards"
    tbl_mt_agents ||--o{ tbl_tt_transact : "collects/processes"
    
    tbl_mt_customer ||--o{ tbl_mt_customerscheme : "enrolls in"
    tbl_mt_customer ||--o{ tbl_tt_transact : "performs"
    
    tbl_mt_schemes ||--o{ tbl_mt_customerscheme : "includes"
    tbl_mt_schemes ||--o{ tbl_cf_receiptconfig : "has layout"
    tbl_mt_schemes ||--o{ tbl_tt_transact : "categorizes"

    %% Table Definitions

    tbl_sys_developers {
        UUID developer_id PK
        VARCHAR(100) email
        VARCHAR(255) password_hash
        VARCHAR(50) role
        TIMESTAMP created_at
    }

    tbl_sys_audit_trail {
        UUID audit_id PK
        VARCHAR(100) table_name
        VARCHAR(100) record_id
        TEXT description
        VARCHAR(100) changed_field
        TEXT previous_value
        TEXT new_value
        TIMESTAMP updated_date
        UUID updated_by
    }

    tbl_mt_banks {
        UUID bank_id PK
        VARCHAR(150) bank_name
        TEXT address
        VARCHAR(100) email
        VARCHAR(15) phone
        VARCHAR(255) password_hash
        VARCHAR(100) name_ceo
        DATE license_expiery
        DATE grace_period_end
        VARCHAR(20) account_status
    }

    tbl_mt_agents {
        UUID agent_id PK
        UUID bank_id FK
        VARCHAR(100) name
        VARCHAR(15) phone_no
        VARCHAR(100) agent_id_number
        DECIMAL(10_2) cah_holding_limit
        INT cash_holding_days
    }

    tbl_mt_schemes {
        UUID scheme_id PK
        UUID bank_id FK
        VARCHAR(100) scheme_name
        CHAR(1) status
        CHAR(1) permitted_operation
    }

    tbl_mt_customer {
        INT customer_id PK
        UUID agent_id FK
        UUID bank_id FK
        VARCHAR(50) type
        VARCHAR(100) name
        DECIMAL(10_8) shop_lat
        DECIMAL(11_8) shop_long
    }

    tbl_mt_customerscheme {
        INT _id PK
        INT customer_id FK
        UUID scheme_id FK
        DECIMAL(10_2) schem_opening_amount
        DECIMAL(10_2) monthly_target
        CHAR(1) remittance_periodicity
    }

    tbl_cf_receiptconfig {
        UUID receipt_id PK
        UUID bank_id FK
        UUID scheme_id FK
        JSON fields
    }

    tbl_tt_transact {
        UUID transact_id PK
        VARCHAR(50) receipt_no
        INT customer_id FK
        UUID agent_id FK
        UUID scheme_id FK
        DECIMAL(10_2) transact_amt
        CHAR(1) transact_type
        CHAR(1) transaction_status
        CHAR(1) transact_mode
        DECIMAL(10_2) new_balance
    }
```