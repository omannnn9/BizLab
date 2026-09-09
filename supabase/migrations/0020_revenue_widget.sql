-- =====================================================================
-- BizLab — 0020: add the "Revenue Metrics" dashboard widget type named
-- explicitly in the product brief's Phase 6 (Dashboard) requirements —
-- flagged as missing in docs/AUDIT_REPORT.md and closed here now that
-- finance_revenue_entries (0017) exists to back it.
-- =====================================================================

alter type public.widget_type add value 'revenue_metrics';
