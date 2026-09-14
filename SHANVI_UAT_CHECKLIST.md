# Shanvi Enterprises - User Acceptance Testing Checklist

This document is for Shanvi Enterprises staff, not developers. It walks through the everyday
business scenarios the system needs to handle correctly before it's trusted for real work. For
each scenario: do the steps, check the "Expected" result, and mark Pass/Fail in the Business
Acceptance Checklist at the end. If something doesn't match, write down exactly what you did and
what you saw - that's what makes a bug report useful.

You do not need any technical knowledge to run this. Use the actual application in your browser,
logged in with a real (or test) account for each area you're checking.

---

## 1. Customer Setup

1. Create a new customer.
2. Edit that customer's details.
3. Add a contact person to the customer.
4. Create a site (installation location) for that customer.
5. Open the customer's "360" detail page.

**Expected:** everything you entered shows up consistently - the customer's name, contact, and
site all appear together on their detail page and wherever else the customer is referenced
(quotations, orders, invoices, projects).

## 2. Product & Inventory

1. Create a new product.
2. Assign it a category.
3. Add stock for that product.
4. View current stock.
5. Perform a stock movement (e.g. an adjustment).
6. View stock broken down by location.
7. If the product uses serial numbers, add a serial number and confirm it's tracked.

**Expected:** the stock quantity shown always matches what you actually added/removed. A serial
number never appears "in stock" in two places at once.

## 3. Quotation

1. Create a customer (or use an existing one).
2. Create an Energy quotation for them.
3. Add products/equipment to it.
4. Add an installation/service line if relevant.
5. Apply any discount/tax.
6. Review the total.
7. Change the quotation's status (e.g. Sent, Approved).
8. Create a revision, if you need to change something after sending it.
9. Generate/view the quotation PDF (print view).

**Expected:** the total on screen matches what you'd calculate by hand from the line items, tax,
and discount. The printed version is something you'd actually be comfortable sending to a
customer.

## 4. Sales Order

1. Start from an approved quotation (or create a Sales Order directly).
2. Check the customer, items, quantities, prices, and taxes carried over correctly.
3. Confirm the order.

**Expected:** nothing needs to be re-entered from the quotation - the Sales Order should already
reflect it correctly.

## 5. Customer Invoice

1. Create an invoice (from a Sales Order, or standalone).
2. Check: invoice number, customer, products/services, tax, total, due date.
3. Generate/view the invoice PDF.

**Expected:** the invoice is something you could actually hand to a customer as-is. The due date
and total are correct.

## 6. Customer Payment

1. Create an invoice for **₹1,00,000**.
2. Record a payment of **₹60,000** against it.
3. Confirm the invoice now shows **₹40,000 outstanding**.
4. Record a second payment of the remaining **₹40,000**.
5. Confirm the invoice now shows **₹0 outstanding** and status **Paid**.
6. Open the customer's Ledger and confirm both payments and the invoice appear correctly.

**Expected:** the numbers above match exactly. This is one of the most important checks in the
whole system - if this doesn't reconcile, stop and report it immediately.

## 7. Purchase

1. Create a Purchase Order to a vendor.
2. Receive a **partial** quantity against it.
3. Check inventory increased by exactly that partial quantity.
4. Receive the **remaining** quantity.
5. Check inventory now reflects the full ordered quantity.
6. Create a Vendor Invoice for what was purchased.
7. Confirm it shows up as a Payable.
8. Record a Vendor Payment against it.
9. Confirm the Payable reduces by the payment amount.

**Expected:** inventory only ever increases when stock is actually *received*, never just because a
Purchase Order was created. The payable amount always matches Vendor Invoice minus Vendor Payments.

## 8. Project

1. Create a Project from a confirmed Sales Order.
2. Select (or create) a Site for it.
3. Confirm the project shows the right customer, site, and equipment (scope items).
4. Check the milestones list looks sensible.
5. Assign equipment to the project (quantity, or a specific serial number).
6. Create and complete an Installation.
7. Confirm the installed equipment now appears in the Installed Equipment registry.

**Expected:** the project always shows the correct customer/site, and equipment only shows as
"installed" after an installation was actually completed for it - not just assigned.

## 9. Warranty / AMC

1. Create a Warranty for a piece of installed equipment.
2. Confirm its status (Active / Expiring Soon / Expired) looks right for the dates you entered -
   you should never have to type the status yourself.
3. Create an AMC (Annual Maintenance Contract) for a customer.
4. Confirm the start date, end date, number of included visits, and visits remaining are all
   correct.

**Expected:** warranty/AMC status always matches today's date versus the start/end dates you
entered - if you change the end date, the status should update accordingly next time you view it.

## 10. Service

1. Create a Service Request for a piece of installed equipment (e.g. a customer complaint).
2. Assign it to a staff member.
3. Schedule a Maintenance Visit for it.
4. Complete the maintenance visit - record findings and any parts used.
5. Resolve the Service Request with a resolution note.
6. Open the equipment's Service History and confirm this visit shows up.

**Expected:** you cannot resolve a service request without writing down what was actually done. The
equipment's history should let you answer "what happened last time this was serviced?" without
digging.

## 11. Expense

1. Create an expense (e.g. installation labour, transport).
2. Link it to a Project.
3. Open that project and confirm its "Project Expenses" total includes the new expense.
4. Open the project's Profitability tab and confirm the expense is reflected in the estimated
   cost/profit figures.

**Expected:** the project's expense total and profitability update automatically - you should never
need to manually add up expenses yourself.

## 12. Management

Review, as a business owner/manager would:

1. The Dashboard - sales, receivables, payables, expenses, and the estimated gross profit figure.
2. The Reports section - pick two or three reports and check the numbers make sense against what
   you know actually happened.
3. The Profitability section - pick a project you know the real numbers for and sanity-check the
   estimated profit shown.

**Expected:** every number on the dashboard should be explainable - you should be able to click
through (or at least trace by category) to see exactly which invoices/expenses/payments produced
it. If a number looks wrong, that's a P1 issue (see classification below) - report it rather than
assuming it's fine.

**Important:** figures labelled "Estimated" or "Operational" (Estimated Gross Profit, Estimated
Project Margin, etc.) are management estimates for decision-making, not statutory accounting
figures. Don't file these with a tax authority or auditor as final numbers - see
`MVP_BASELINE.md`'s Financial Disclaimer.

---

## Business Acceptance Checklist

| Area | Business User | Result | Notes |
|---|---|---|---|
| Customers | | Pass/Fail | |
| Vendors | | Pass/Fail | |
| Products | | Pass/Fail | |
| Inventory | | Pass/Fail | |
| Quotations | | Pass/Fail | |
| Sales Orders | | Pass/Fail | |
| Invoices | | Pass/Fail | |
| Customer Payments | | Pass/Fail | |
| Purchases | | Pass/Fail | |
| Vendor Payments | | Pass/Fail | |
| Projects | | Pass/Fail | |
| Installation | | Pass/Fail | |
| Warranty | | Pass/Fail | |
| AMC | | Pass/Fail | |
| Service | | Pass/Fail | |
| Expenses | | Pass/Fail | |
| Reports | | Pass/Fail | |

## Reporting a Problem - Classification

When something doesn't work as expected, classify it so it gets the right priority:

- **P0 - Critical**: data loss, a security problem, one company's data visible to another company,
  or financial figures that are corrupted (not just wrong-looking, but actually broken/inconsistent
  in the database). Report immediately.
- **P1 - High**: an important workflow is broken, a financial amount is wrong, inventory numbers
  don't reconcile, or an invoice/payment relationship is inconsistent.
- **P2 - Medium**: a usability problem, a missing filter that isn't critical, a minor workflow
  inconvenience.
- **P3 - Low**: a cosmetic issue, wording you'd word differently, or an idea for something new.

After the MVP freeze: P0/P1 issues get fixed right away. P2 issues get fixed if they'd actually
block the pilot. P3 issues and "it would be nice if..." requests go into `POST_MVP_BACKLOG.md`
rather than being built immediately - this keeps the system stable during the pilot instead of
constantly changing underneath you.
