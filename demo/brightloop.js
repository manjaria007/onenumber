// Demo content for "Brightloop", a fictional subscription software company.
// All names, people and numbers are invented for the Codegeist demo.

export const COMPANY = 'Brightloop (fictional)';

export const METRIC_PAGES = [
  {
    title: 'Churn rate — Finance definition',
    fields: {
      Metric: 'Churn rate',
      Aliases: 'customer churn, logo churn',
      Owner: 'Priya Raman (Finance Analytics)',
      Team: 'Finance',
      Status: 'Canonical',
      Definition: 'Share of paying customers at the start of the period who cancelled during the last 90 days.',
      'Time window': '90 days',
      Includes: 'paying customers',
      Excludes: 'trial accounts, internal test accounts',
      'Source tables': 'billing.subscriptions',
    },
    sql: `SELECT COUNT(DISTINCT s.account_id)
FROM billing.subscriptions s
WHERE s.status = 'cancelled'
  AND s.is_trial = false
  AND s.account_type <> 'internal'
  AND s.cancelled_at >= current_date - INTERVAL '90 days'`,
  },
  {
    title: 'Customer churn — Marketing dashboard',
    fields: {
      Metric: 'Customer churn',
      Aliases: 'churn rate',
      Owner: 'Diego Alvarez (Growth Marketing)',
      Team: 'Marketing',
      Status: 'Draft',
      Definition: 'Accounts with no product activity in the last 30 days, as a share of all accounts.',
      'Time window': '30 days',
      Includes: 'paying customers, trial accounts',
      Excludes: 'internal test accounts',
      'Source tables': 'product.events',
    },
    sql: `SELECT COUNT(DISTINCT e.account_id)
FROM product.events e
WHERE e.account_type <> 'internal'
  AND e.last_active_at < current_date - INTERVAL '30 days'`,
  },
  {
    title: 'Net revenue — Finance definition',
    fields: {
      Metric: 'Net revenue',
      Aliases: 'net sales',
      Owner: 'Priya Raman (Finance Analytics)',
      Team: 'Finance',
      Status: 'Canonical',
      Definition: 'Invoiced revenue after refunds, credits and sales tax, recognised in the period.',
      'Time window': '1 month',
      Excludes: 'refunds, credits, sales tax',
      'Source tables': 'billing.invoices',
    },
    sql: `SELECT SUM(i.net_amount)
FROM billing.invoices i
WHERE i.status = 'paid'
  AND i.invoiced_at >= current_date - INTERVAL '1 month'`,
  },
  {
    title: 'Net revenue — Sales pipeline report',
    fields: {
      Metric: 'Net revenue',
      Owner: 'Hannah Okafor (Sales Ops)',
      Team: 'Sales',
      Status: 'Draft',
      Definition: 'Closed-won bookings minus sales tax for the month.',
      'Time window': '1 month',
      Excludes: 'sales tax',
      'Source tables': 'crm.opportunities',
    },
    sql: `SELECT SUM(o.amount)
FROM crm.opportunities o
WHERE o.stage = 'closed_won'
  AND o.closed_at >= current_date - INTERVAL '1 month'`,
  },
  {
    title: 'Active customers — Product definition',
    fields: {
      Metric: 'Active customers',
      Aliases: 'active accounts',
      Owner: 'Mei Lin (Product Analytics)',
      Team: 'Product',
      Status: 'Canonical',
      Definition: 'Paying accounts with at least one product session in the last 28 days.',
      'Time window': '28 days',
      Excludes: 'trial accounts, internal test accounts',
      'Source tables': 'product.sessions',
    },
    sql: `SELECT COUNT(DISTINCT s.account_id)
FROM product.sessions s
WHERE s.is_trial = false
  AND s.account_type <> 'internal'
  AND s.started_at >= current_date - INTERVAL '28 days'`,
  },
  {
    title: 'Active accounts — Customer Success playbook',
    fields: {
      Metric: 'Active accounts',
      Aliases: 'active customers',
      Owner: 'Sam Patel (Customer Success)',
      Team: 'Customer Success',
      Status: 'Draft',
      Definition: 'Same as the Product definition; CS uses it for health scores.',
      'Time window': '28 days',
      Excludes: 'trial accounts, internal test accounts',
      'Source tables': 'product.sessions',
    },
    sql: `SELECT COUNT(DISTINCT s.account_id)
FROM product.sessions s
WHERE s.is_trial = false
  AND s.account_type <> 'internal'
  AND s.started_at >= current_date - INTERVAL '28 days'`,
  },
];

export const JIRA_REQUESTS = [
  {
    summary: 'Q4 board deck: churn is 4.1% in our slide but Finance says 6.3%',
    description:
      'Marketing pulled customer churn from the growth dashboard for the Q4 board deck. Finance reports churn rate at 6.3%. Which number do we present on Thursday?',
  },
  {
    summary: 'Reconcile net revenue for the November business review',
    description: 'Sales ops net revenue is about 8% higher than the Finance number. Need one number for the review.',
  },
  {
    summary: 'Add active customers to the Customer Success health dashboard',
    description: 'Please add the active customers count next to NPS on the CS dashboard.',
  },
];
