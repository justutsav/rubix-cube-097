-- A beneficiary interviewed at a kiosk has no phone number, and we must not invent one.
--
-- `phone_hash` was NOT NULL because the IVR path always has an MSISDN. But the kiosk and assisted
-- channels are the ones that exist precisely for people who do NOT have a phone — 51.6% of rural
-- women aged 15+ own no mobile at all, and the assisted door was built for exactly them. Requiring
-- a hash there forces a fabricated identity: hashing a device id would produce a value shaped like
-- a phone hash that can never match a real call, quietly poisoning the cross-channel resume that
-- the column exists to serve.
--
-- Nulls stay distinct under the (phone_hash, ordinal) unique constraint, so any number of
-- phone-less beneficiaries coexist without collision.

alter table beneficiary alter column phone_hash drop not null;

comment on column beneficiary.phone_hash is
  'hmac(e164, server_pepper), computed server-side. NULL for kiosk and assisted-mode interviews, '
  'where the beneficiary genuinely has no phone. Never the raw number, never a stand-in.';
