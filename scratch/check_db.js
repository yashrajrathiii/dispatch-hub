const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
let supabaseUrl = '';
let supabaseKey = '';
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  for (const line of lines) {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join('=').trim().replace(/^["']|["']$/g, '');
      if (key === 'VITE_SUPABASE_URL') supabaseUrl = val;
      if (key === 'VITE_SUPABASE_PUBLISHABLE_KEY') supabaseKey = val;
    }
  }
} catch (e) {
  console.error("Error reading .env file:", e.message);
}

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking orders...");
  const { data: orders, error: oErr } = await supabase.from('orders').select('id, order_number, created_at').limit(5);
  if (oErr) {
    console.error("Error fetching orders:", oErr.message);
  } else {
    console.log("Orders:", orders);
  }

  console.log("\nChecking dispatches...");
  const { data: dispatches, error: dErr } = await supabase.from('dispatches').select('id, dispatch_number, created_at').limit(5);
  if (dErr) {
    console.error("Error fetching dispatches:", dErr.message);
  } else {
    console.log("Dispatches:", dispatches);
  }

  console.log("\nChecking walkin_purchases...");
  const { data: walkin, error: wErr } = await supabase.from('walkin_purchases').select('id, walkin_number, created_at').limit(5);
  if (wErr) {
    console.error("Error fetching walkin_purchases:", wErr.message);
  } else {
    console.log("Walkin purchases:", walkin);
  }
}

check();
