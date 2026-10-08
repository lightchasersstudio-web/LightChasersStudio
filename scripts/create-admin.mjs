// Creates (or promotes) an admin account. There is no public sign-up.
//
//   npm run admin:create -- owner@example.com "Full Name" [owner|admin]
//
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// New users get a random temporary password printed once; sign in and change it.
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const [email, fullName = null, role = "admin"] = process.argv.slice(2);

if (!email || !email.includes("@") || !["owner", "admin"].includes(role)) {
  console.error('Usage: npm run admin:create -- <email> ["Full Name"] [owner|admin]');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local).",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserId(targetEmail) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === targetEmail.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
}

let userId = await findUserId(email);
let tempPassword = null;

if (!userId) {
  tempPassword = randomBytes(18).toString("base64url");
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });
  if (error) throw error;
  userId = data.user.id;
}

const { error: profileError } = await supabase
  .from("admin_profiles")
  .upsert({ user_id: userId, full_name: fullName, role }, { onConflict: "user_id" });
if (profileError) throw profileError;

console.log(`Admin ready: ${email} (${role})`);
if (tempPassword) console.log(`Temporary password (shown once): ${tempPassword}`);
