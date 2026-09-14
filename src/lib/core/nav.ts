import type { ModuleKey } from "./permissions";

export type NavLink = {
  label: string;
  href: string;
};

export type NavSection = {
  label: string;
  moduleKey: ModuleKey;
  href?: string;
  items?: NavLink[];
};

export const NAV_SECTIONS: NavSection[] = [
  { label: "Dashboard", moduleKey: "dashboard", href: "/dashboard" },
  {
    label: "Parties",
    moduleKey: "parties",
    items: [
      { label: "Clients", href: "/parties/clients" },
      { label: "Vendors", href: "/parties/vendors" },
    ],
  },
  {
    label: "Sales",
    moduleKey: "sales",
    items: [
      { label: "Quotations", href: "/sales/quotations" },
      { label: "Sales Orders", href: "/sales/sales-orders" },
      { label: "Invoices", href: "/sales/invoices" },
      { label: "Payments Received", href: "/sales/payments-received" },
      { label: "Payment Reminders", href: "/sales/payment-reminders" },
    ],
  },
  {
    label: "Purchase",
    moduleKey: "purchase",
    items: [
      { label: "Purchase Orders", href: "/purchase/purchase-orders" },
      { label: "Purchase Receipts", href: "/purchase/purchase-receipts" },
      { label: "Vendor Invoices", href: "/purchase/vendor-invoices" },
      { label: "Vendor Payments", href: "/purchase/payments-made" },
    ],
  },
  {
    label: "Inventory",
    moduleKey: "inventory",
    items: [
      { label: "Products", href: "/inventory/products" },
      { label: "Stock", href: "/inventory/stock" },
      { label: "Serial Numbers", href: "/inventory/serial-numbers" },
    ],
  },
  {
    label: "Projects",
    moduleKey: "projects",
    items: [
      { label: "Projects", href: "/projects" },
      { label: "Sites", href: "/projects/sites" },
      { label: "Installations", href: "/projects/installations" },
    ],
  },
  {
    label: "Service",
    moduleKey: "service",
    items: [
      { label: "Service Requests", href: "/service/service-requests" },
      { label: "AMC", href: "/service/amc" },
      { label: "Maintenance", href: "/service/maintenance" },
    ],
  },
  {
    label: "Warranty",
    moduleKey: "warranty",
    items: [
      { label: "Installed Equipment", href: "/warranty/equipment" },
      { label: "Warranties", href: "/warranty/warranties" },
    ],
  },
  {
    label: "Finance",
    moduleKey: "finance",
    items: [
      { label: "Receivables", href: "/finance/receivables" },
      { label: "Payables", href: "/finance/payables" },
      { label: "Customer Ledger", href: "/finance/customer-ledger" },
      { label: "Vendor Ledger", href: "/finance/vendor-ledger" },
      { label: "Transactions", href: "/finance/transactions" },
      { label: "Expenses", href: "/finance/expenses" },
      { label: "Profitability", href: "/finance/profitability" },
    ],
  },
  { label: "Reports", moduleKey: "reports", href: "/reports" },
  { label: "Settings", moduleKey: "settings", href: "/settings" },
];
