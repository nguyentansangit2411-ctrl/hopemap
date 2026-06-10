import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Thay thế ID này bằng Clerk user_id thật của bạn (có dạng user_2xxxx...)
const MY_CLERK_USER_ID = process.argv[2];

if (!MY_CLERK_USER_ID) {
  console.error("Vui lòng cung cấp Clerk User ID.");
  console.error("Cách dùng: node scripts/seed.mjs user_2xxxx...");
  process.exit(1);
}

async function runSeed() {
  console.log(`Bắt đầu cấp quyền Admin cho user: ${MY_CLERK_USER_ID}`);

  // Upsert user_profile
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ 
      id: MY_CLERK_USER_ID, 
      display_name: 'Super Admin',
      role: 'admin' 
    }, { onConflict: 'id' });

  if (error) {
    console.error("Lỗi:", error.message);
  } else {
    console.log("✅ Thành công! User này hiện đã là Admin.");
  }
}

runSeed();
