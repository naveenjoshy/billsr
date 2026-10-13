# Product Requirements Document (PRD) v6.0

## Daily Collection Management System

## 1. Executive Summary

The Daily Collection Management System is a comprehensive financial tool designed for banks to streamline field collections and withdrawals. It bridges the gap between banks, field collection agents, and customers. Version 6.0 incorporates a centralized Super Admin (Developer) module, comprehensive KYC metadata, multi-scheme customer mapping, scheme-based receipt configurations, dual-directional transactions, and a dedicated, system-wide granular Audit Trail to track every state change for maximum compliance and security.

## 2. Stakeholders & System Modules

* **Module 1: The Developer (Super Admin):** Centralized management of all participating financial institutions. Handles initial enrollment of new banks, provisions Bank Admin accounts, monitors operational software licenses, issues renewal reminders, grants operational grace periods, and enacts system-wide suspensions for non-compliant banks.
* **Module 2: The Bank (Admin):** Manages branches, agents, schemes, and compliance parameters. Responsible for resolving pending transaction cancellations and tracking operations against their active software license expiry.
* **Module 3: The Collection Agent (Field User):** Operates the mobile application for customer onboarding (capturing extensive KYC like ID types, ID urls, and photos), recording deposits/withdrawals, and issuing scheme-specific thermal receipts. Bound by strict cash-in-hand limits and daily settlement targets.
* **Module 4: The Customer (End User):** Shop owners/vendors enrolled in specific financial schemes with defined opening amounts and periodicities. Identified via QR-code, photo, and geo-location for secure, on-site daily transactions.

## 3. Core Functional Requirements

### 3.1 Authentication, Onboarding & Compliance

* **Unified Role-Based Access Control (RBAC):** Developers, Bank Admins, and Collection Agents utilize a single, shared initial login screen using their email ID and password. Upon submission, the database authenticates the credentials and evaluates the assigned role.
* **Advanced Bank Compliance & License Tracking:** Bank operations are strictly tied to their operational software license expiration date. Automated suspensions occur based on license and grace period ends.
* **Enhanced KYC Onboarding:** Agents and Customers require robust verification, utilizing dedicated photo URL pathways, ID numbers, and specific ID types stored securely within the primary records.
* **System-Wide Audit Logging:** Every modification (create, update, delete, status change) across all modules is securely logged in a central audit table, capturing the exact field changes, previous/new values, and the user responsible for the change.

### 3.2 Scheme-Based Financial Operations

* **Customer-Scheme Bridging:** Customers map to specific schemes (`tbl_mt_customerscheme`) dictating their individual opening amounts, targeted monthly collections, and required remittance periodicity.
* **Scheme-Based Configurations:** Receipt layouts are standardized at the scheme level using JSON payloads for Bluetooth thermal printers.

## 4. Database Design (DBML Format)

```dbml
Table tbl_sys_developers {
  developer_id UUID [pk]
  email VARCHAR(100)
  password_hash VARCHAR(255)
  role VARCHAR(50)
  created_at TIMESTAMP
}

Table tbl_sys_audit_trail {
  audit_id UUID [pk]
  table_name VARCHAR(100)
  record_id VARCHAR(100)
  description TEXT
  changed_field VARCHAR(100)
  previous_value TEXT
  new_value TEXT
  updated_date TIMESTAMP
  updated_by UUID
}

Table tbl_mt_banks {
  bank_id UUID [pk]
  bank_name VARCHAR(150)
  address TEXT
  email VARCHAR(100)
  phone VARCHAR(15)
  password_hash VARCHAR(255)
  name_ceo VARCHAR(100)
  designation VARCHAR(100)
  license_expiery DATE
  grace_period_end DATE
  account_status VARCHAR(20)
  last_reminder_sent DATE
  created_at TIMESTAMP
  created_by UUID
  modified_at TIMESTAMP
  modified_by UUID
}

Table tbl_mt_agents {
  agent_id UUID [pk]
  bank_id UUID [ref: > tbl_mt_banks.bank_id]
  name VARCHAR(100)
  address TEXT
  phone_no VARCHAR(15)
  email VARCHAR(100)
  agent_photo_url VARCHAR(100)
  agent_id_url VARCHAR(100)
  agent_id_number VARCHAR(30)
  agent_id_type VARCHAR(30)
  password_reset_flag BOOLEAN
  last_password_change_date TIMESTAMP
  cah_holding_limit DECIMAL(10,2)
  cash_holding_days INT
  created_at TIMESTAMP
  created_by UUID
  modified_at TIMESTAMP
  modified_by UUID
}

Table tbl_mt_schemes {
  scheme_id UUID [pk]
  bank_id UUID [ref: > tbl_mt_banks.bank_id]
  scheme_name VARCHAR(100)
  scheme_description TEXT
  status CHAR(1)
  permitted_operation CHAR(1)
  created_at TIMESTAMP
  created_by UUID
  modified_at TIMESTAMP
  modified_by UUID
}

Table tbl_mt_customer {
  customer_id INT [pk]
  agent_id UUID [ref: > tbl_mt_agents.agent_id]
  bank_id UUID [ref: > tbl_mt_banks.bank_id]
  type VARCHAR(50)
  name VARCHAR(100)
  address TEXT
  customer_photo_url VARCHAR(150)
  phone VARCHAR(15)
  email VARCHAR(100)
  shop_name VARCHAR(150)
  shop_lat DECIMAL(10,8)
  shop_long DECIMAL(11,8)
  shop_photo_url TEXT
  created_at TIMESTAMP
  created_by UUID
  modified_at TIMESTAMP
  modified_by UUID
}

Table tbl_mt_customerscheme {
  _id INT [pk]
  customer_id INT [ref: > tbl_mt_customer.customer_id]
  scheme_id UUID [ref: > tbl_mt_schemes.scheme_id]
  schem_opening_amount DECIMAL(10,2)
  monthly_target DECIMAL(10,2)
  remittance_periodicity CHAR(1)
  created_at TIMESTAMP
  created_by UUID
  modified_at TIMESTAMP
  modified_by UUID
}

Table tbl_cf_receiptconfig {
  receipt_id UUID [pk]
  bank_id UUID [ref: > tbl_mt_banks.bank_id]
  scheme_id UUID [ref: > tbl_mt_schemes.scheme_id]
  fields JSON
  created_at TIMESTAMP
  modified_at TIMESTAMP
}

Table tbl_tt_transact {
  transact_id UUID [pk]
  receipt_no VARCHAR(50)
  customer_id INT [ref: > tbl_mt_customer.customer_id]
  agent_id UUID [ref: > tbl_mt_agents.agent_id]
  scheme_id UUID [ref: > tbl_mt_schemes.scheme_id]
  transact_amt DECIMAL(10,2)
  transact_type CHAR(1)
  transaction_status CHAR(1)
  transact_mode CHAR(1)
  opening_bal DECIMAL(10,2)
  new_balance DECIMAL(10,2)
  cancellation_reason TEXT
  reviewed_by UUID
  collect_date TIMESTAMP
}
```

## 5. Database Design (JSON Format)

```json
{
  "developers": [
    {
      "_id": "ObjectId",
      "email": "String",
      "password_hash": "String",
      "role": "String ('Developer')",
      "audit_trail": { "created_at": "ISODate" }
    }
  ],
  "audit_logs": [
    {
      "_id": "ObjectId",
      "collection_name": "String",
      "document_id": "String",
      "description": "String",
      "changed_field": "String",
      "previous_value": "Mixed",
      "new_value": "Mixed",
      "updated_date": "ISODate",
      "updated_by": "ObjectId"
    }
  ],
  "banks": [
    {
      "_id": "ObjectId",
      "bank_name": "String",
      "address": "String",
      "email": "String",
      "phone": "String",
      "password_hash": "String",
      "name_ceo": "String",
      "designation": "String",
      "license_expiry": "ISODate",
      "compliance_status": {
        "account_status": "String ('Active', 'Grace', 'Suspended')",
        "grace_period_end": "ISODate",
        "last_renewal_reminder_sent": "ISODate"
      },
      "audit_trail": {
        "created_at": "ISODate",
        "created_by": "ObjectId",
        "modified_at": "ISODate",
        "modified_by": "ObjectId"
      }
    }
  ],
  "agents": [
    {
      "_id": "ObjectId",
      "bank_id": "ObjectId (Ref: banks)",
      "name": "String",
      "address": "String",
      "phone_no": "String",
      "email": "String",
      "agent_photo_url": "String",
      "agent_id_url": "String",
      "agent_id_number": "String",
      "agent_id_type": "String",
      "password_reset_flag": "Boolean",
      "last_password_change_date": "ISODate",
      "cash_holding_limit": "Decimal128",
      "cash_holding_days": "NumberInt",
      "audit_trail": {
        "created_at": "ISODate",
        "created_by": "ObjectId",
        "modified_at": "ISODate",
        "modified_by": "ObjectId"
      }
    }
  ],
  "schemes": [
    {
      "_id": "ObjectId",
      "bank_id": "ObjectId (Ref: banks)",
      "scheme_name": "String",
      "scheme_description": "String",
      "status": "String ('A' or 'S')",
      "permitted_operation": "String ('A' or 'S')",
      "receipt_config": {
        "fields": [
          {
            "field_name": "String",
            "data_type": "String",
            "is_mandatory": "Boolean",
            "print_order": "NumberInt"
          }
        ]
      }
    }
  ],
  "customers": [
    {
      "_id": "ObjectId",
      "agent_id": "ObjectId (Ref: agents)",
      "bank_id": "ObjectId (Ref: banks)",
      "type": "String",
      "name": "String",
      "address": "String",
      "customer_photo_url": "String",
      "phone": "String",
      "email": "String",
      "shop_name": "String",
      "location": {
        "type": "Point",
        "coordinates": [77.5946, 12.9716]
      },
      "shop_photo_url": "String",
      "audit_trail": {
        "created_at": "ISODate",
        "created_by": "ObjectId",
        "modified_at": "ISODate",
        "modified_by": "ObjectId"
      }
    }
  ],
  "customer_schemes": [
    {
      "_id": "ObjectId",
      "customer_id": "ObjectId (Ref: customers)",
      "scheme_id": "ObjectId (Ref: schemes)",
      "schem_opening_amount": "Decimal128",
      "monthly_target": "Decimal128",
      "remittance_periodicity": "String ('D', 'W', 'A', 'M', 'N')",
      "audit_trail": {
        "created_at": "ISODate",
        "created_by": "ObjectId",
        "modified_at": "ISODate",
        "modified_by": "ObjectId"
      }
    }
  ],
  "transactions": [
    {
      "_id": "ObjectId",
      "receipt_no": "String",
      "bank_id": "ObjectId (Ref: banks)",
      "customer_id": "ObjectId (Ref: customers)",
      "agent_id": "ObjectId (Ref: agents)",
      "scheme_id": "ObjectId (Ref: schemes)",
      "transact_amt": "Decimal128",
      "transact_type": "String ('D' or 'W')",
      "transaction_status": "String ('A', 'C', or 'P')",
      "transact_mode": "String ('C' or 'T')",
      "balance_snapshot": {
        "opening_bal": "Decimal128",
        "new_balance": "Decimal128"
      },
      "cancellation_info": {
        "cancellation_reason": "String",
        "reviewed_by": "ObjectId (Ref: banks)"
      },
      "collect_date": "ISODate"
    }
  ]
}
```