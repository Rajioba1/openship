-- Per-server mail-install record. A row here means "openship has provisioned
-- (or is provisioning) the mail stack on this server". Lets /emails resolve
-- "which server is the mail server" without round-tripping SSH to read a
-- state file on every page load. The state file on the host stays the
-- source of truth for installation step progress; this table is just the
-- fast routing answer for the dashboard.
--
-- ON DELETE CASCADE: dropping the server row drops the mail record too, so
-- there's no dangling "this server is a mail server" pointer after server
-- deletion.
CREATE TABLE "mail_servers" (
  "server_id" text PRIMARY KEY REFERENCES "servers"("id") ON DELETE CASCADE,
  "domain" text NOT NULL,
  "installed_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
