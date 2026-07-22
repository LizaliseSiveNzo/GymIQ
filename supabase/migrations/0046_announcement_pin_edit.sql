-- Announcements: pinned flag, send_announcement(+p_pinned), update_announcement, set_announcement_pinned,
-- my_announcements returns/order by pinned. Bodies applied via MCP 0043_announcement_pin_edit.
alter table public.announcements add column if not exists pinned boolean not null default false;
