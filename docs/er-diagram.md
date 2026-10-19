# ER Diagram Specification (DBML Format)


Table users {
  id varchar [pk, note: "Mongoose ObjectId"]
  userID varchar [not null, unique]
  name varchar [not null]
  email varchar [not null, unique]
  password_hash varchar [not null]
  role varchar [not null, note: "Enum: 'Superadmin', 'Developer', 'Bank', 'Agent'"]
  is_active boolean [default: true]
  created_at timestamp [default: `now()` ]
  modified_at timestamp [default: `now()` ]
}

Table banks {
  id varchar [pk, note: "Mongoose ObjectId"]
  user_id varchar [not null, unique]
  bank_name varchar [not null]
  address varchar [not null]
  phone varchar [not null]
  name_ceo varchar
  designation varchar
  license_expiry timestamp [not null]
  
  // Flattened compliance_status
  account_status varchar [not null, default: 'Active', note: "Enum: 'Active', 'Grace', 'Suspended'"]
  grace_period_end timestamp
  last_renewal_reminder_sent timestamp
  
  // Flattened audit_trail
  created_at timestamp [default: `now()` ]
  created_by varchar
  modified_at timestamp [default: `now()` ]
  modified_by varchar
}

Table agents {
  id varchar [pk, note: "Mongoose ObjectId"]
  user_id varchar [not null, unique]
  bank_id varchar [not null]
  address varchar [not null]
  phone_no varchar [not null]
  agent_photo_url varchar
  agent_id_url varchar
  agent_id_number varchar
  agent_id_type varchar
  password_reset_flag boolean [default: true]
  last_password_change_date timestamp
  cash_holding_limit decimal
  cash_holding_days integer [not null]

  // Flattened audit_trail
  created_at timestamp [default: `now()` ]
  created_by varchar
  modified_at timestamp [default: `now()` ]
  modified_by varchar
}

Table customers {
  id varchar [pk, note: "Mongoose ObjectId"]
  agent_id varchar [not null]
  bank_id varchar [not null]
  type varchar
  name varchar [not null]
  address varchar
  customer_photo_url varchar
  phone varchar [not null]
  email varchar
  shop_name varchar
  
  // Flattened GeoJSON location
  location_type varchar [not null, default: 'Point']
  longitude decimal [not null]
  latitude decimal [not null]
  
  shop_photo_url varchar

  // Flattened audit_trail
  created_at timestamp [default: `now()` ]
  created_by varchar
  modified_at timestamp [default: `now()` ]
  modified_by varchar
}

Table schemes {
  id varchar [pk, note: "Mongoose ObjectId"]
  bank_id varchar [not null]
  scheme_name varchar [not null]
  scheme_description varchar
  status varchar [not null, default: 'A', note: "Enum: A (Active), S (Suspended)"]
  permitted_operation varchar [not null, default: 'A', note: "Enum: A (Active), S (Suspended)"]
}

// Normalized array block from SchemeSchema
Table scheme_receipt_fields {
  id varchar [pk, note: "Mongoose subdocument _id"]
  scheme_id varchar [not null]
  field_name varchar [not null]
  data_type varchar [not null]
  is_mandatory boolean [default: false]
  print_order integer
}

Table customer_schemes {
  id varchar [pk, note: "Mongoose ObjectId"]
  customer_id varchar [not null]
  scheme_id varchar [not null]
  scheme_opening_amount decimal [not null]
  monthly_target decimal
  remittance_periodicity varchar [not null, note: "Enum: D (Daily), W (Weekly), A (As & When), M (Monthly), N (None)"]

  // Flattened audit_trail
  created_at timestamp [default: `now()` ]
  created_by varchar
  modified_at timestamp [default: `now()` ]
  modified_by varchar
}

Table transactions {
  id varchar [pk, note: "Mongoose ObjectId"]
  receipt_no varchar [not null, unique]
  bank_id varchar [not null]
  customer_id varchar [not null]
  agent_id varchar [not null]
  scheme_id varchar [not null]
  transact_amt decimal [not null]
  transact_type varchar [not null, note: "Enum: D (Deposit), W (Withdrawal)"]
  transaction_status varchar [not null, default: 'P', note: "Enum: A (Approved), C (Cancelled), P (Pending)"]
  transact_mode varchar [not null, default: 'C', note: "Enum: C (Cash), T (Transfer)"]
  
  // Flattened balance_snapshot
  opening_bal decimal [not null]
  new_balance decimal [not null]
  
  // Flattened cancellation_info
  cancellation_reason varchar
  reviewed_by varchar
  
  collect_date timestamp [not null, default: `now()` ]
}

Table audit_logs {
  id varchar [pk, note: "Mongoose ObjectId"]
  collection_name varchar [not null]
  document_id varchar [not null, note: "Polymorphic reference ID"]
  description varchar [not null]
  changed_field varchar
  previous_value json [note: "Mongoose Mixed Type"]
  new_value json [note: "Mongoose Mixed Type"]
  updated_date timestamp [default: `now()` ]
  updated_by varchar [not null]
}

// --- Relationships ---

// User Extensions (One-to-One)
Ref: banks.user_id - users.id [delete: cascade]
Ref: agents.user_id - users.id [delete: cascade]

// Hierarchy Links (Many-to-One)
Ref: agents.bank_id > banks.id
Ref: customers.agent_id > agents.id
Ref: customers.bank_id > banks.id
Ref: schemes.bank_id > banks.id

// Embedded configuration relation
Ref: scheme_receipt_fields.scheme_id > schemes.id [delete: cascade]

// Customer Scheme Subscriptions
Ref: customer_schemes.customer_id > customers.id
Ref: customer_schemes.scheme_id > schemes.id

// Transaction Engine Mappings
Ref: transactions.bank_id > banks.id
Ref: transactions.customer_id > customers.id
Ref: transactions.agent_id > agents.id
Ref: transactions.scheme_id > schemes.id
Ref: transactions.reviewed_by > users.id

// System Logs Tracking
Ref: audit_logs.updated_by > users.id

// Audit Trails (Many-to-One)
Ref: banks.created_by > users.id
Ref: banks.modified_by > users.id
Ref: agents.created_by > users.id
Ref: agents.modified_by > users.id
Ref: customers.created_by > users.id
Ref: customers.modified_by > users.id
Ref: customer_schemes.created_by > users.id
Ref: customer_schemes.modified_by > users.id
```
