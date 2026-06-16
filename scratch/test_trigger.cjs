const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manually parse .env file
let supabaseUrl = '';
let supabaseKey = '';
try {
  const envPath = path.join(__dirname, '..', '.env');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  for (const line of envLines) {
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

async function testTrigger() {
  const email = "vipin1974@gmail.com";
  const password = "qwerty";
  
  console.log(`Signing in user: ${email}...`);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authErr) {
    console.error("Sign in failed:", authErr.message);
    console.log("Creating/Registering user instead...");
    // Let's sign up if they don't exist
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: "Vipin Rathi" } }
    });
    if (signUpErr) {
      console.error("Sign up failed:", signUpErr.message);
      process.exit(1);
    }
    console.log("Sign up successful. Please run script again after database auto-promotes/creates user.");
    process.exit(0);
  }

  const userId = authData.user.id;
  console.log(`Sign in successful. User Auth ID: ${userId}`);

  // Fetch from public.users to see if app user exists
  const { data: appUser, error: appUserErr } = await supabase
    .from('users')
    .select('*')
    .eq('auth_user_id', userId)
    .single();

  if (appUserErr) {
    console.error("Error fetching public.users record:", appUserErr.message);
    process.exit(1);
  }

  console.log("App User details:", appUser);

  // 1. Get or create a buyer for testing
  let buyerId;
  const { data: buyers, error: buyerErr } = await supabase.from('buyers').select('id').limit(1);
  if (buyerErr) {
    console.error("Error fetching buyers:", buyerErr.message);
    process.exit(1);
  }

  if (buyers.length > 0) {
    buyerId = buyers[0].id;
  } else {
    console.log("Creating a test buyer...");
    const { data: newBuyer, error: newBuyerErr } = await supabase.from('buyers').insert({
      name: "Test Buyer",
      category: "RETAILER"
    }).select('id').single();
    if (newBuyerErr) {
      console.error("Error creating test buyer:", newBuyerErr.message);
      process.exit(1);
    }
    buyerId = newBuyer.id;
  }

  console.log(`Using Buyer ID: ${buyerId}`);

  // 2. Insert test order
  console.log("Inserting test order...");
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      buyer_id: buyerId,
      created_by_user_id: appUser.id,
      total_amount: 100
    })
    .select('*')
    .single();

  if (orderErr) {
    console.error("Error inserting order:", orderErr.message);
    process.exit(1);
  }

  console.log("Inserted Order details:", {
    id: order.id,
    order_number: order.order_number,
    created_at: order.created_at,
    created_by_user_id: order.created_by_user_id
  });

  // 3. Clean up the order
  console.log("Cleaning up test order...");
  const { error: delErr } = await supabase.from('orders').delete().eq('id', order.id);
  if (delErr) {
    console.error("Error deleting order:", delErr.message);
  } else {
    console.log("Test order deleted successfully.");
  }
}

testTrigger();
