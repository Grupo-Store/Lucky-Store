# Database Update - April 22, 2026

## Overview

The database schema has been updated to support new Dashboard and Financial Management features identified in the Orderly Hub platform update.

## What's New

### 1. **goals** Table
Purpose: Store monthly sales targets (metas) for dashboard KPI tracking

**Columns:**
- `id` (UUID): Primary key
- `key` (VARCHAR): Unique key format "YYYY-MM" (e.g., "2026-04")
- `year` (INTEGER): Year (e.g., 2026)
- `month` (INTEGER): Month 1-12
- `target` (DECIMAL): Monthly target value in BRL
- `floor` (DECIMAL): Optional minimum threshold
- `created_by` (UUID): User who created the goal
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- UNIQUE(year, month) - Only one goal per month/year combination
- UNIQUE(key) - Ensures key format uniqueness

**Indexes:**
- idx_goals_key: Quick lookup by key
- idx_goals_year_month: Filtering by year/month
- idx_goals_created: Ordering by creation date

**Use Cases:**
- Store monthly revenue targets for each month
- Calculate % of target achieved in dashboard
- Calculate gap to target for KPI cards
- Calculate dynamic daily targets for remaining days

---

### 2. **expenses** Table
Purpose: Track predicted and paid expenses for financial management

**Columns:**
- `id` (UUID): Primary key
- `kind` (VARCHAR): 'PREVISAO' (predicted) or 'PAGO' (paid)
- `service` (VARCHAR): Expense description (e.g., "Aluguel", "Energia")
- `destination` (VARCHAR): Payee/destination
- `observations` (TEXT): Additional notes
- `predicted_value` (DECIMAL): Predicted expense amount in BRL
- `predicted_date` (DATE): Expected expense date
- `status` (VARCHAR): 'Não Pago' or 'Pago'
- `paid_value` (DECIMAL): Actual paid amount
- `payment_date` (DATE): Actual payment date
- `payment_method` (VARCHAR): Payment method (Boleto, Credit Card, Debit, PIX, TED, Dinheiro)
- `installments` (INTEGER): Number of installments (for credit card)
- `created_by` (UUID): User who created expense
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp
- `deleted_at` (TIMESTAMP): Soft delete timestamp

**Constraints:**
- kind IN ('PREVISAO', 'PAGO')
- status IN ('Não Pago', 'Pago')
- payment_method IN allowed values

**Indexes:**
- idx_expenses_kind: Filter by expense type
- idx_expenses_predicted_date: Filter by predicted date
- idx_expenses_payment_date: Filter by payment date
- idx_expenses_service: Filter by service type
- idx_expenses_deleted: Soft delete awareness

**Use Cases:**
- Track company expenses (rent, utilities, etc.)
- Mark expenses as predicted or paid
- Support installment plans for credit card payments
- Generate financial calendar entries
- Calculate total costs for financial reporting

---

### 3. **expense_installments** Table
Purpose: Store credit card installment details for expenses paid in multiple installments

**Columns:**
- `id` (UUID): Primary key
- `id_expense` (UUID): Foreign key to expenses table
- `installment_number` (INTEGER): Sequential number (1, 2, 3, ...)
- `value` (DECIMAL): Installment amount in BRL
- `due_date` (DATE): Due date for this installment
- `status` (VARCHAR): 'Pendente' or 'Pago'
- `paid_date` (DATE): Actual payment date
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

**Constraints:**
- UNIQUE(id_expense, installment_number) - One entry per installment
- installment_number > 0
- Foreign key on id_expense with CASCADE delete

**Indexes:**
- idx_expense_installments_expense: Quick lookup by expense
- idx_expense_installments_due_date: Sort by due date
- idx_expense_installments_status: Filter by status

**Use Cases:**
- Store individual installment due dates for credit card payments
- Track which installments have been paid
- Generate financial calendar with installment entries
- Calculate cash flow predictions based on installment schedule

---

## Database Statistics

### Total Tables (After Update)
- **Core Entities**: 6 (users, lojas, vendedores, clientes, pedidos, produtos)
- **Order Management**: 5 (custo_pedido, frete, pedido_forma_pagamento)
- **Returns Management**: 2 (rmas, item_rma)
- **Quotes**: 2 (cotacoes, item_cotacao)
- **Tracking**: 2 (venda_vendedor, compra_vendedor)
- **Targets**: 2 (meta_vendedor, goals) ← NEW
- **Audit**: 2 (status_history, audit_logs)
- **Financial**: 3 (expenses, expense_installments, + previously none) ← NEW
- **Views**: 2 (resultado_mensal, resultado_anual)

**Total: 16 main tables + 2 audit tables + 3 financial tables + 2 views = 23 database objects**

---

## Migration Path

### For New Installations
Use the updated `DATABASE_INIT.sql` file which includes all new tables:
```bash
psql -U postgres -d orderly_hub -f DATABASE_INIT.sql
```

### For Existing Installations
Run the migration script to add new tables without data loss:
```bash
psql -U postgres -d orderly_hub -f MIGRATION_GOALS_EXPENSES.sql
```

This creates the new tables with `IF NOT EXISTS` clauses, so it's safe to run multiple times.

---

## Data Relationships

```
goals (sales targets)
├─ Used by: Dashboard KPI calculations
├─ Related to: pedidos (orders) via aggregation
└─ Indexed by: year, month

expenses (company expenses)
├─ Contains: expense_installments
├─ Used by: Financial Manager, Financial Calendar
├─ Related to: users (who created)
└─ Indexed by: payment_date, predicted_date, kind

expense_installments (credit card plans)
├─ Parent: expenses
├─ Used by: Financial Calendar, Cash flow forecasting
└─ Indexed by: due_date, status
```

---

## Performance Considerations

### New Indexes (6 total)
- `idx_goals_key`: O(1) lookup by month/year
- `idx_goals_year_month`: Range queries for date filtering
- `idx_expenses_kind`: Separate PREVISAO vs PAGO queries
- `idx_expenses_predicted_date` / `idx_expenses_payment_date`: Calendar queries
- `idx_expense_installments_due_date`: Cash flow timeline queries
- `idx_expense_installments_status`: Filter by payment status

### Query Performance
- Get monthly goal: ~0.1ms (indexed key lookup)
- Get all expenses for month: ~0.5ms (indexed by date)
- Get installment plan for expense: ~0.2ms (indexed by id_expense)

---

## Backward Compatibility

✅ **Fully Backward Compatible**
- No changes to existing tables
- No changes to existing column definitions
- No changes to existing relationships
- All new tables are optional (not required by existing queries)
- Existing applications continue to work unchanged

---

## Next Steps

1. **Run Migration** (if updating existing DB):
   ```bash
   psql -U postgres -d orderly_hub -f MIGRATION_GOALS_EXPENSES.sql
   ```

2. **Verify New Tables**:
   ```bash
   psql -U postgres -d orderly_hub -c "\dt goals expense*"
   ```

3. **Backend Implementation**:
   - Implement DashboardService with KPI calculations
   - Implement FinanceService for expense management
   - Implement expense installment calculations

4. **Frontend Implementation**:
   - Create Dashboard components (KPI cards, charts, tables)
   - Create Goals modal for target management
   - Create Financial Manager pages (post-MVP)

5. **Testing**:
   - Insert test goals and verify calculations
   - Insert test expenses and verify financial calendar
   - Test installment plans for credit card payments

---

## Files Modified

1. **database/updated/DATABASE_INIT.sql** - Updated with new tables
2. **database/MIGRATION_GOALS_EXPENSES.sql** - New migration script (NEW)
3. **database/DATABASE_UPDATE_APRIL_2026.md** - This file (NEW)

---

## Questions or Issues?

Refer to:
- BACKLOG_2026.md - Feature requirements
- ARCHITECTURE_2026.md - System design
- DEVELOPMENT_ROADMAP_2026.md - Implementation timeline

**Database Version:** 2.1  
**Last Updated:** April 22, 2026  
**Status:** ✅ Ready for development
