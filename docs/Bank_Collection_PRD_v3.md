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
Table users {
  user_id UUID [pk]
  name VARCHAR(100)
  email VARCHAR(100)
  password_hash VARCHAR(255)
  role VARCHAR(50)
  is_active 
  created_at TIMESTAMP
}

Table audit_log {
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

Table banks {
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

Table agents {
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

Table schemes {
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

Table customer {
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

Table customerscheme {
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

Table receiptconfig {
  receipt_id UUID [pk]
  bank_id UUID [ref: > tbl_mt_banks.bank_id]
  scheme_id UUID [ref: > tbl_mt_schemes.scheme_id]
  fields JSON
  created_at TIMESTAMP
  modified_at TIMESTAMP
}

Table transact {
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


## 5. Database Design (JSON Format)

{
  "database_name": "Banking_System",
  "tables": [
    {
      "table_name": "users",
      "columns": [
        { "name": "user_id", "type": "UUID", "is_primary_key": true },
        { "name": "name", "type": "VARCHAR", "length": 100 },
        { "name": "email", "type": "VARCHAR", "length": 100 },
        { "name": "password_hash", "type": "VARCHAR", "length": 255 },
        { "name": "role", "type": "VARCHAR", "length": 50 },
        { "name": "is_active", "type": "BOOLEAN" },
        { "name": "created_at", "type": "TIMESTAMP" }
      ]
    },
    {
      "table_name": "audit_log",
      "columns": [
        { "name": "audit_id", "type": "UUID", "is_primary_key": true },
        { "name": "table_name", "type": "VARCHAR", "length": 100 },
        { "name": "record_id", "type": "VARCHAR", "length": 100 },
        { "name": "description", "type": "TEXT" },
        { "name": "changed_field", "type": "VARCHAR", "length": 100 },
        { "name": "previous_value", "type": "TEXT" },
        { "name": "new_value", "type": "TEXT" },
        { "name": "updated_date", "type": "TIMESTAMP" },
        { "name": "updated_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "banks",
      "columns": [
        { "name": "bank_id", "type": "UUID", "is_primary_key": true },
        { "name": "bank_name", "type": "VARCHAR", "length": 150 },
        { "name": "address", "type": "TEXT" },
        { "name": "email", "type": "VARCHAR", "length": 100 },
        { "name": "phone", "type": "VARCHAR", "length": 15 },
        { "name": "password_hash", "type": "VARCHAR", "length": 255 },
        { "name": "name_ceo", "type": "VARCHAR", "length": 100 },
        { "name": "designation", "type": "VARCHAR", "length": 100 },
        { "name": "license_expiery", "type": "DATE" },
        { "name": "grace_period_end", "type": "DATE" },
        { "name": "account_status", "type": "VARCHAR", "length": 20 },
        { "name": "last_reminder_sent", "type": "DATE" },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "created_by", "type": "UUID" },
        { "name": "modified_at", "type": "TIMESTAMP" },
        { "name": "modified_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "agents",
      "columns": [
        { "name": "agent_id", "type": "UUID", "is_primary_key": true },
        { "name": "bank_id", "type": "UUID" },
        { "name": "name", "type": "VARCHAR", "length": 100 },
        { "name": "address", "type": "TEXT" },
        { "name": "phone_no", "type": "VARCHAR", "length": 15 },
        { "name": "email", "type": "VARCHAR", "length": 100 },
        { "name": "agent_photo_url", "type": "VARCHAR", "length": 100 },
        { "name": "agent_id_url", "type": "VARCHAR", "length": 100 },
        { "name": "agent_id_number", "type": "VARCHAR", "length": 30 },
        { "name": "agent_id_type", "type": "VARCHAR", "length": 30 },
        { "name": "password_reset_flag", "type": "BOOLEAN" },
        { "name": "last_password_change_date", "type": "TIMESTAMP" },
        { "name": "cah_holding_limit", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "cash_holding_days", "type": "INT" },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "created_by", "type": "UUID" },
        { "name": "modified_at", "type": "TIMESTAMP" },
        { "name": "modified_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "schemes",
      "columns": [
        { "name": "scheme_id", "type": "UUID", "is_primary_key": true },
        { "name": "bank_id", "type": "UUID" },
        { "name": "scheme_name", "type": "VARCHAR", "length": 100 },
        { "name": "scheme_description", "type": "TEXT" },
        { "name": "status", "type": "CHAR", "length": 1 },
        { "name": "permitted_operation", "type": "CHAR", "length": 1 },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "created_by", "type": "UUID" },
        { "name": "modified_at", "type": "TIMESTAMP" },
        { "name": "modified_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "customer",
      "columns": [
        { "name": "customer_id", "type": "INT", "is_primary_key": true },
        { "name": "agent_id", "type": "UUID" },
        { "name": "bank_id", "type": "UUID" },
        { "name": "type", "type": "VARCHAR", "length": 50 },
        { "name": "name", "type": "VARCHAR", "length": 100 },
        { "name": "address", "type": "TEXT" },
        { "name": "customer_photo_url", "type": "VARCHAR", "length": 150 },
        { "name": "phone", "type": "VARCHAR", "length": 15 },
        { "name": "email", "type": "VARCHAR", "length": 100 },
        { "name": "shop_name", "type": "VARCHAR", "length": 150 },
        { "name": "shop_lat", "type": "DECIMAL", "precision": 10, "scale": 8 },
        { "name": "shop_long", "type": "DECIMAL", "precision": 11, "scale": 8 },
        { "name": "shop_photo_url", "type": "TEXT" },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "created_by", "type": "UUID" },
        { "name": "modified_at", "type": "TIMESTAMP" },
        { "name": "modified_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "customerscheme",
      "columns": [
        { "name": "_id", "type": "INT", "is_primary_key": true },
        { "name": "customer_id", "type": "INT" },
        { "name": "scheme_id", "type": "UUID" },
        { "name": "schem_opening_amount", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "monthly_target", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "remittance_periodicity", "type": "CHAR", "length": 1 },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "created_by", "type": "UUID" },
        { "name": "modified_at", "type": "TIMESTAMP" },
        { "name": "modified_by", "type": "UUID" }
      ]
    },
    {
      "table_name": "receiptconfig",
      "columns": [
        { "name": "receipt_id", "type": "UUID", "is_primary_key": true },
        { "name": "bank_id", "type": "UUID" },
        { "name": "scheme_id", "type": "UUID" },
        { "name": "fields", "type": "JSON" },
        { "name": "created_at", "type": "TIMESTAMP" },
        { "name": "modified_at", "type": "TIMESTAMP" }
      ]
    },
    {
      "table_name": "transact",
      "columns": [
        { "name": "transact_id", "type": "UUID", "is_primary_key": true },
        { "name": "receipt_no", "type": "VARCHAR", "length": 50 },
        { "name": "customer_id", "type": "INT" },
        { "name": "agent_id", "type": "UUID" },
        { "name": "scheme_id", "type": "UUID" },
        { "name": "transact_amt", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "transact_type", "type": "CHAR", "length": 1 },
        { "name": "transaction_status", "type": "CHAR", "length": 1 },
        { "name": "transact_mode", "type": "CHAR", "length": 1 },
        { "name": "opening_bal", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "new_balance", "type": "DECIMAL", "precision": 10, "scale": 2 },
        { "name": "cancellation_reason", "type": "TEXT" },
        { "name": "reviewed_by", "type": "UUID" },
        { "name": "collect_date", "type": "TIMESTAMP" }
      ]
    }
  ],
  "relationships": [
    { "from_table": "agents", "from_column": "bank_id", "to_table": "banks", "to_column": "bank_id" },
    { "from_table": "schemes", "from_column": "bank_id", "to_table": "banks", "to_column": "bank_id" },
    { "from_table": "customer", "from_column": "agent_id", "to_table": "agents", "to_column": "agent_id" },
    { "from_table": "customer", "from_column": "bank_id", "to_table": "banks", "to_column": "bank_id" },
    { "from_table": "customerscheme", "from_column": "customer_id", "to_table": "customer", "to_column": "customer_id" },
    { "from_table": "customerscheme", "from_column": "scheme_id", "to_table": "schemes", "to_column": "scheme_id" },
    { "from_table": "receiptconfig", "from_column": "bank_id", "to_table": "banks", "to_column": "bank_id" },
    { "from_table": "receiptconfig", "from_column": "scheme_id", "to_table": "schemes", "to_column": "scheme_id" },
    { "from_table": "transact", "from_column": "customer_id", "to_table": "customer", "to_column": "customer_id" },
    { "from_table": "transact", "from_column": "agent_id", "to_table": "agents", "to_column": "agent_id" },
    { "from_table": "transact", "from_column": "scheme_id", "to_table": "schemes", "to_column": "scheme_id" }
  ]
}
