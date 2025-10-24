-- Add field to track if email was manually changed
alter table participants add column if not exists manual_email_override boolean not null default false;

-- Add comment explaining the field
comment on column participants.manual_email_override is 'True if the email was manually changed by an admin and should not be overridden by Pretix sync';
