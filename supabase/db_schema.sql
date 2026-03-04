-- WICHTIG: Löscht alle bestehenden Tabellen und erstellt sie mit TEXT-IDs neu
-- Führe dieses Script nur aus, wenn du eine saubere Datenbank haben willst!

-- Drop existing tables in correct order (due to foreign keys)
DROP TABLE IF EXISTS booking_room_assignments CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS company_settings CASCADE;

-- 1. LOCATIONS
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. PROPERTIES
CREATE TABLE properties (
  id TEXT PRIMARY KEY,
  location_id TEXT REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  street TEXT,
  zip TEXT,
  city TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ROOMS
CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1,
  room_count NUMERIC(4, 1) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. CUSTOMERS
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  customer_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  street TEXT,
  zip TEXT,
  city TEXT,
  country TEXT DEFAULT 'Deutschland',
  management TEXT,
  contact_person TEXT,
  accounting_contact TEXT,
  billing_address_override TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. INVOICES
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  booking_id TEXT,
  customer_name_snapshot TEXT,
  customer_number_snapshot TEXT,
  billing_address_snapshot TEXT,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  service_period_start DATE,
  service_period_end DATE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status TEXT CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled')) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. INVOICE ITEMS
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE CASCADE,
  pos INTEGER NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  quantity NUMERIC(10, 2) NOT NULL,
  unit TEXT CHECK (unit IN ('Tage', 'Stück', 'Pauschale')),
  unit_price NUMERIC(10, 2) NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  vat_rate NUMERIC(4, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. BOOKINGS
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  customer_id TEXT REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  project_name TEXT,
  status TEXT CHECK (status IN ('reserved', 'confirmed', 'cancelled')) DEFAULT 'reserved',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  bed_count INTEGER NOT NULL DEFAULT 1,
  price_per_bed_per_night NUMERIC(10, 2) NOT NULL,
  customer_name_snapshot TEXT,
  invoice_number_snapshot TEXT,
  customer_number_snapshot TEXT,
  billing_address_snapshot TEXT,
  customer_email_snapshot TEXT,
  customer_phone_snapshot TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for invoices -> bookings
ALTER TABLE invoices ADD CONSTRAINT fk_invoices_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL;

-- 8. BOOKING ROOM ASSIGNMENTS
CREATE TABLE booking_room_assignments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  booking_id TEXT REFERENCES bookings(id) ON DELETE CASCADE,
  room_id TEXT REFERENCES rooms(id) ON DELETE RESTRICT,
  assigned_beds INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. COMPANY SETTINGS
CREATE TABLE company_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT NOT NULL,
  address TEXT,
  zip_city TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  ceo TEXT,
  hrb TEXT,
  court TEXT,
  vat_id TEXT,
  tax_id TEXT,
  bank_name TEXT,
  iban TEXT,
  bic TEXT
);

CREATE UNIQUE INDEX only_one_row ON company_settings ((TRUE));

-- ROW LEVEL SECURITY
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_room_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Policies for public access (development)
CREATE POLICY "Enable all access" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON properties FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON booking_room_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access" ON company_settings FOR ALL USING (true) WITH CHECK (true);
-- ==========================================
-- UPDATE: PDF Storage (Added 2026-01-26)
-- ==========================================

-- 1. Add pdf_path to invoices
ALTER TABLE invoices ADD COLUMN pdf_path TEXT;

-- 2. Create Storage Bucket 'invoices'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies
-- Allow public read access to invoices bucket
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'invoices' );

-- Allow authenticated users to upload to invoices bucket
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'invoices' AND auth.role() = 'authenticated' );
