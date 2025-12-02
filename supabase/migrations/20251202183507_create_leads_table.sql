/*
  # Create Leads Table

  1. New Tables
    - `leads`
      - `id` (uuid, primary key) - Unique identifier for each lead
      - `created_at` (timestamptz) - When the lead was created
      - `name` (text) - Patient's full name
      - `email` (text) - Patient's email address
      - `phone` (text) - Patient's phone number
      - `age` (integer) - Patient's age
      - `budget_min` (integer) - Minimum budget in currency
      - `budget_max` (integer) - Maximum budget in currency
      - `timeline` (text) - When they want the procedure (e.g., '1-3 months')
      - `analysis_data` (jsonb) - Full analysis results and recommendations
      - `photos` (jsonb) - Array of captured photo URLs/data
      - `status` (text) - Lead status: 'new', 'contacted', 'qualified', 'converted'
      - `notes` (text) - Additional notes from patient
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `leads` table
    - Add policy for authenticated admin users to read all leads
    - Add policy for anyone to insert their own lead (public form submission)

  3. Indexes
    - Index on email for quick lookup
    - Index on created_at for sorting
    - Index on status for filtering
*/

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  age integer,
  budget_min integer,
  budget_max integer,
  timeline text,
  analysis_data jsonb,
  photos jsonb,
  status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted')),
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert leads (public form submission)
CREATE POLICY "Anyone can submit lead"
  ON leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow authenticated users to read all leads (for admin dashboard)
CREATE POLICY "Authenticated users can view all leads"
  ON leads
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update leads (for admin dashboard)
CREATE POLICY "Authenticated users can update leads"
  ON leads
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();