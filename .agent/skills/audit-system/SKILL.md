---
name: tennis-app-audit-system
description: Standard and procedures for auditing the Tennis App system logic, verifying data integrity, and ensuring business rule compliance.
---

# Tennis App System Audit Standard

This document establishes the standard for auditing the Tennis App logic, relationships, and data integrity. Use this skill before implementing new features or modifying existing ones to ensure no regressions in business logic.

## 1. System Overview & Core Relationships

Understanding the relationships is the foundation of any audit.

### 1.1 Core Entities
- **Coach (`profiles`)**: The primary user managing the business.
- **Student (`players`)**: The end customer. Can belong to a **Unified Payment Group**.
- **Plan (`pricing_plans`)**: Implementation of pricing strategy (Monthly, Packages).
- **Subscription (`player_subscriptions`)**: The link between a Student and a Plan. Tracks status (`active`, `cancelled`) and consumption (`remaining_classes`).
- **Class Group (`class_groups`)**: A logical grouping for recurring sessions (often linked to a Plan).
- **Session (`sessions`)**: A concrete instance of a class (schedule, court, coach).
- **Session Participation (`session_players`)**: Link between Session and Student.
- **Transaction (`transactions`)**: Financial record (Payment, Charge, Refund, Adjustment).

### 1.2 Key Data Flows
- **Billing**: Students are assigned Plans > Subscriptions created > Monthly/Per-session Charges generated > Payments recorded > Balance updated.
- **Scheduling**: Sessions created > Students added > (Trigger) Integrity checks & Logic > Charges/Consumption applied.
- **Cancellations**: Student removed/Session cancelled > (Trigger) `tr_audit_player_removal` / `tr_audit_session_soft_delete` > **Refund** Transaction created automatically.

## 2. Audit Checklist

Run these checks to validate system health.

### 2.1 Database Integrity Audit (SQL)
*Run these queries in Supabase SQL Editor to check for anomalies.*

#### A. Orphaned Records
- [ ] **Orphaned Session Players**: `SELECT count(*) FROM session_players sp LEFT JOIN sessions s ON sp.session_id = s.id WHERE s.id IS NULL;` (Should be 0)
- [ ] **Orphaned Transactions**: `SELECT count(*) FROM transactions t LEFT JOIN players p ON t.player_id = p.id WHERE p.id IS NULL;` (Should be 0)

#### B. Logic Constraints
- [ ] **Multiple Active Subscriptions**: `SELECT player_id, count(*) FROM player_subscriptions WHERE status = 'active' GROUP BY player_id HAVING count(*) > 1;` (Warning: Usually players have 1 active plan, unless mixing Package + Monthly).
- [ ] **Negative Remaining Classes**: `SELECT count(*) FROM player_subscriptions WHERE remaining_classes < 0;` (Should be 0).

### 2.2 Business Logic Audit (Functional)

#### A. Payments & Balances
1.  **Balance Calculation**: Verify `player_balances` view matches manual sum of `transactions` for a sample player.
    *   *Rule*: Balance = Sum(Payments + Refunds) - Sum(Charges + Adjustments).
2.  **Unified Groups**: Verify `unified_payment_group_balances` correctly aggregates all member balances.
    *   *Rule*: Group Balance = (Group Payments) + Sum(Member Individual Payments) - Sum(Member Charges).

#### B. Session Management
1.  **Conflict Resolution**: When scheduling, ensure `checkSessionConflicts` (in `useSessions.ts`) correctly identifies:
    *   Same player in multiple sessions at same time.
    *   Same coach/instructor in multiple sessions.
    *   Same Location + Court collision.
2.  **Hard vs Soft Delete**:
    *   *Rule*: Future Session (>24h) = Hard Delete (Remove row).
    *   *Rule*: Near/Past Session (<=24h) = Soft Delete (`deleted_at` set, status='cancelled').

#### C. Cancellation & Refunds (Critical)
*Logic Location: `20260131100000_improve_refund_audit.sql` / `handle_session_delete_audit` trigger*
1.  **Automatic Refund**: Removing a player from a charged session **MUST** generate a 'refund' transaction.
    *   *Audit*: Delete a `session_player` row manually. Check `transactions` for a new 'refund' row with correct description and amount.
2.  **Audit Traceability**: Refund description must include:
    *   Date of original class (Formatted in **Academy Timezone**).
    *   Email of user who performed the action.

### 2.3 Dashboard & Reporting Audit
1.  **Payment Stats**: Compare `usePaymentStats` (RPC `get_payment_stats_skill`) output with raw `transactions` count.
2.  **History**: Ensure `useMonthlyActivity` reflects confirmed usage.

## 3. Critical Financial Logic (Auto-Billing Rules)
*Logic Location: `src/features/payments/hooks/useAutoBilling.ts`*

These rules govern how student accounts are impacted by scheduling.

### 3.1 Per-Class Plans (`per_class`)
*   **Rule**: Charges are generated for classes scheduled **for Today or earlier**.
*   **Behavior**:
    *   Future classes (> End of Today) do **NOT** generate immediate debt.
    *   Classes scheduled for **Today** generate debt immediately (via Auto-Billing job or manual trigger).
    *   **Audit Check**: Verify that a class scheduled for tomorrow shows `0` balance impact today, but `+Price` impact tomorrow.

### 3.2 Monthly Plans (`monthly`)
*   **Rule**: Charges are generated **after the month concludes** (Mes Vencido).
*   **Behavior**:
    *   Debt is accrued on the 1st of the *next* month for the *previous* month.
    *   Condition: Student must have had at least 1 active class in the month.
    *   **Audit Check**: Ensure no monthly charges appear for the *current* month until it ends.

### 3.3 Packages (`package`)
*   **Rule**: **NO** monetary debt is generated per class.
*   **Behavior**:
    *   Consumption is tracked via `remaining_classes` (Stock).
    *   Financial transaction occurs only upon **Package Purchase** (Payment).
    *   **Audit Check**: Verify `transactions` table has NO 'charge' rows for sessions linked to Package subscriptions.

### 3.4 Cancellations & Refunds
*   **Future (>24h)**: Hard Delete. Row removed. No financial impact.
*   **Near Term (<=24h / Past)**: Soft Delete (`cancelled`).
    *   **Per-Class**: Original Charge remains. A **Refund** transaction is created to zero out the balance.
    *   **Package**: Class credit should be returned (increment `remaining_classes`). *Note: Verify implementation of package credit return.*

## 4. Best Practices for Changes

- **Modifying Payments**: Always update `player_balances` view logic if adding new transaction types.
- **Modifying Sessions**: If changing `sessions` schema, update `checkSessionConflicts` to include new fields (e.g., specific courts).
- **RLS Policies**: When adding tables, ALWAYS add RLS policies.
    *   *Standard*: Coach can view/edit own data.
    *   *Academy*: Owner can view/edit all academy data.

## 5. Common Pitfalls to Avoid
- **Timezones**: Always use `AT TIME ZONE` with the **Academy's configured timezone** (not hardcoded) for all user-facing dates.
- **Recursion**: Watch out for infinite recursion in RLS policies for `academy_members` or `profiles`.
- **Soft Delete Ignorance**: Frontend queries MUST filter `.is('deleted_at', null)` for sessions, otherwise cancelled classes reappear.

## 6. Standard Query Scripts
Refer to `queries/audit_integrity.sql` for a batched integrity check script.
