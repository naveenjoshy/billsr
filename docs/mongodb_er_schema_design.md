# MongoDB Schema Design: Daily Collection Management System (v6.0)

This document outlines the NoSQL database schema (MongoDB) for the Daily Collection Management System, fully updated with the centralized Developer module, Audit Logs, and Customer-Scheme linkage.

```json

{
   "users": [
    {
      "_id": "ObjectId",
      "userID": "String (Unique login identifier or custom alphanumeric code)",
      "name": "String",
      "email": "String",
      "password_hash": "String",
      "role": "String ('Superadmin', 'Bank', 'Agent')",
      "is_active": "Boolean",
      "audit_trail": {
        "created_at": "ISODate",
        "modified_at": "ISODate"
      }
    }
  ],
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
      "user_id": "ObjectId (Ref: users)", 
      "bank_name": "String",
      "address": "String",
      "phone": "String",
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
      "user_id": "ObjectId (Ref: users)", 
      "bank_id": "ObjectId (Ref: banks)",
      "address": "String",
      "phone_no": "String",
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
