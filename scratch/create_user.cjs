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

async function register() {
  const email = "vipin1974@gmail.com";
  const password = "qwerty";
  
  console.log(`Signing up user: ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Vipin"
      }
    }
  });

  if (error) {
    console.error("Sign up failed:", error.message);
    process.exit(1);
  }

  console.log("Sign up successful!");
  console.log("User details:", data.user ? { id: data.user.id, email: data.user.email } : data);
  console.log("\nNext step: Run the SQL query to promote this user to OWNER.");
}

register();
