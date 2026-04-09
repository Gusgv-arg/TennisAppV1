# Fix Android Google login flash

## Goal
Resolve the issue where after signing in with Google on Android the login screen briefly reappears before the app navigates to the main tabs.

## Changes Required
1. **src/features/auth/LoginScreen.tsx**
   - After a successful `supabase.auth.setSession` call, navigate to the appropriate tab (`/(tabs)` for coaches or `/(player-tabs)` for players) using `router.replace`.
   - Ensure `setLoading(false)` is called after navigation.
   - Add error handling to always clear loading state.
2. **app/_layout.tsx**
   - Update the redirect effect to avoid forcing a redirect to `/login` when a session has just been established while the user is on the auth screens.
   - Add a guard that checks `segments[0] === '(auth)'` and a valid `session` before performing the redirect to `/login`.
   - In the deep‑link listener, after setting the session, also trigger navigation to the main tabs.

## Verification Plan
- Run the Android app (Expo dev client) and perform Google sign‑in.
- Confirm the login screen does not flash and the app lands directly on the main tab.
- Verify the web flow remains unchanged.
- Check console logs for any unexpected errors.

## Open Questions
> [!IMPORTANT]
> None. The required navigation targets are known.

## Implementation Steps
1. Edit `LoginScreen.tsx` to add navigation after `setSession`.
2. Edit `_layout.tsx` to add the guard in the redirect effect and navigation in the deep‑link handler.
3. Test on Android and web.

---
*Please review the plan and approve to proceed.*
