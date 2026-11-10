# ROCK UC FOODS - Owner Login & MFA Setup Runbook

> **Playbook v2 Section 28 (Phase 1E)**  
> **Target Role:** System Owner (`Chef Esther Kwentua`)  
> **Security Level:** Level 2 Authentication Assurance (AAL2 with RFC 6238 TOTP)

---

## 1. Disable Public Sign-ups in Supabase

1. Navigate to your **Supabase Dashboard** > **Authentication** > **Providers** > **Email**.
2. Toggle **Disable Signups** to `ON` (or uncheck *"Enable Signups"*).
3. Confirm that the application exposes **no public registration or sign-up routes**. Only pre-provisioned system accounts can log in.

---

## 2. Enable Multi-Factor Authentication (MFA) in Supabase

1. Go to **Authentication** > **MFA**.
2. Ensure **TOTP (Time-based One-Time Password)** is set to **Enabled**.
3. Set the maximum number of factors per user to **1**.

---

## 3. Provision Owner Profile Row in PostgreSQL

Run the following SQL migration in the Supabase SQL Editor to link the Auth user to the application's role profiles:

```sql
-- 1. Create the Owner User in auth.users (if using Supabase Auth dashboard, invite user rock-uc-foods@gmail.com)
-- 2. Insert the owner role into public.profiles
INSERT INTO public.profiles (id, role, is_active, full_name, email)
VALUES (
  'usr-owner-01', -- or auth.users.id
  'owner',
  true,
  'Chef Esther Kwentua',
  'rock-uc-foods@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET
  role = 'owner',
  is_active = true,
  full_name = 'Chef Esther Kwentua';
```

---

## 4. Environment Variables Required

Ensure these environment variables are declared in your deployment settings (`.env.local` / Cloud Run):

```bash
# Public App URL
NEXT_PUBLIC_SITE_URL=https://rockucfoods.com

# IP Hashing Salt for Rate Limiting
IP_HASH_SALT=ruc_production_secure_salt_2026_xyz

# Service Secrets
CRON_SECRET=your_super_secret_cron_key
```

---

## 5. Owner First Sign-In & QR Code Pairing

1. Navigate to `https://<YOUR-DOMAIN>/login` in your mobile or desktop browser.
2. Enter your owner credentials:
   * **Email:** `rock-uc-foods@gmail.com`
   * **Password:** *(Your configured owner password)*
3. Because no verified authenticator is yet enrolled, the system will direct you to `/login/mfa?step=enrol`.
4. Open **Google Authenticator** or **1Password** on your phone.
5. Scan the displayed SVG QR code (or type the manual setup key).
6. Enter the 6-digit code shown in your authenticator app and tap **Verify and Sign In**.
7. Once verified, the factor is cryptographically registered. Future sign-ins will directly prompt for the 6-digit code at `AAL2`.

---

## 6. What is Deliberately NOT Built in Phase 1E

* **Forgotten Password Recovery**: The site does not provide an automated "Forgot Password" email link. If the owner forgets their password, it must be reset directly from the Supabase Auth dashboard.
* **Lost Phone / Lost Authenticator Recovery**: There is no self-serve recovery without administrative intervention. If the owner loses their authenticator device, an administrator must unenroll the factor in the Supabase Dashboard, allowing the owner to enroll a new device upon the next login.
* **Public Sign-Up**: Public self-registration is permanently disabled.
