-- =====================================================================
-- BizLab — 0024: Quick links dashboard widget
-- =====================================================================
-- A widget for pinning links to external tools/docs on the dashboard,
-- rendered as a row of buttons with a title. Stored the same way as
-- every other widget's per-instance settings: dashboard_widgets.config
-- (jsonb), here shaped as { links: [{ id, title, url }, ...] }.

alter type public.widget_type add value 'quick_links';
