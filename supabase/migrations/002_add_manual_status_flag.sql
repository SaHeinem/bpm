-- Add field to track if status was manually set
alter table participants add column if not exists manual_status_override boolean not null default false;

-- Add comment explaining the field
comment on column participants.manual_status_override is 'True if the status was manually set by an admin and should not be overridden by Pretix sync';
