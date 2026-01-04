# Step 2.5: Role-Based Access Control (RBAC) 🔄 IN PROGRESS
**Duration:** 2-3 days

## Overview
Implement a three-tier role system:
- **Admin (Superadmin)** — Full access to all data across all coaches
- **Coach (Profesor)** — Access only to their own data (players, sessions, locations)
- **Student (Alumno)** — Blocked from app access (future enhancement)

> [!NOTE]
> The existing 'admin' role in the database will function as the superadmin. First admin: **Gustavo Gómez Villafañe** (gusgvillafane@gmail.com)

## Tasks

### 1. Update RLS Policies for Admin Access

Add admin bypass policies to all tables:

```sql
-- Update profiles RLS
CREATE POLICY "Admins view all profiles" ON profiles FOR SELECT 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update players RLS
CREATE POLICY "Admins manage all players" ON players FOR ALL 
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update sessions RLS  
CREATE POLICY "Admins manage all sessions" ON sessions FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update locations RLS
CREATE POLICY "Admins manage all locations" ON locations FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update videos RLS
CREATE POLICY "Admins manage all videos" ON videos FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update analyses RLS
CREATE POLICY "Admins manage all analyses" ON analyses FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update coach_annotations RLS
CREATE POLICY "Admins manage all annotations" ON coach_annotations FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Update share_links RLS  
CREATE POLICY "Admins manage all share links" ON share_links FOR ALL
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
```

### 2. Assign First Admin

```sql
-- Assign admin role to Gustavo Gómez Villafañe
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'gusgvillafane@gmail.com';
```

### 3. Create Frontend Role Guard

Create `src/features/auth/hooks/useRoleGuard.ts`:

```typescript
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@/src/store/useAuthStore';

export const useRoleGuard = () => {
  const { user } = useAuthStore();
  
  useEffect(() => {
    // Block students from accessing the app
    if (user?.role === 'student') {
      router.replace('/access-denied');
    }
  }, [user?.role]);
  
  return {
    isAdmin: user?.role === 'admin',
    isCoach: user?.role === 'coach', 
    isStudent: user?.role === 'student',
    role: user?.role,
  };
};
```

### 4. Create Access Denied Screen

Create `app/access-denied.tsx` for students.

### 5. Update Translations

Add to `es.json` and `en.json`:
- `role.admin` / `role.superadmin`
- `role.coach` / `role.profesor`
- `role.student` / `role.alumno`
- `accessDenied` messages

## Deliverables
- [ ] RLS policies updated for admin access
- [ ] First admin assigned (Gustavo Gómez Villafañe)
- [ ] Role guard hook created
- [ ] Access denied screen for students
- [ ] Translations added

## ✅ Owner Verification Checkpoint
| Check | Status |
|-------|--------|
| Admin can view all coaches' data | ⬜ |
| Coach can only view own data | ⬜ |
| Student sees "Access Denied" screen | ⬜ |
| Role displayed correctly in UI | ⬜ |
