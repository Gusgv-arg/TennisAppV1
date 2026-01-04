# RBAC Setup Instructions

## Step 1: Execute RLS Policies Migration

1. Open your Supabase Dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/migrations/20260104_add_admin_rls_policies.sql`
4. Click **Run** to execute the migration

This will add admin bypass policies to all tables.

## Step 2: Assign First Admin Role

In the **SQL Editor**, run the following command:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'gusgvillafane@gmail.com';
```

**Expected result:** `UPDATE 1` (if your profile exists)

## Step 3: Verify Admin Access

1. Log in to the app with your account (gusgvillafane@gmail.com)
2. Navigate to any module (Players, Sessions, Locations)
3. As admin, you should be able to see data from ALL coaches (not just your own)

## Step 4: Test Student Blocking

To test that students are blocked:

1. Create a test user with `student` role in Supabase
2. Log in with that account
3. You should see the "Access Denied" screen immediately
4. The only option should be to log out

## Troubleshooting

**Profile not found?**
- Make sure you've signed up with gusgvillafane@gmail.com
- Check the `profiles` table in Supabase Table Editor

**Still seeing only your own data?**
- Log out and log back in to refresh the session
- Check that the RLS policies were created successfully
- Verify your role is set to 'admin' in the profiles table
