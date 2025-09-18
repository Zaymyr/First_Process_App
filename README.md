This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Simplified Invitation Flow

This app implements a minimal, single-page invitation & access flow using Supabase native emails.

### Overview
| Case | Detection | Action Sent | User Experience |
|------|-----------|-------------|-----------------|
| New user | No existing user | `auth.admin.inviteUserByEmail` | Email -> click -> /auth/accept -> set password -> org |
| Existing unconfirmed | `email_confirmed_at == null` | `auth.resend({ type: 'signup' })` | Email -> click -> /auth/accept -> set password -> org |
| Confirmed, no password | `user_metadata.has_password != true` | `auth.resetPasswordForEmail` | Email -> click -> /auth/accept -> set password -> org |
| Confirmed with password | else | `signInWithOtp` magic link | Email -> click -> /auth/accept -> auto accept -> org |

### Single Landing Page `/auth/accept`
The page:
1. Establishes a session (PKCE `code`, OTP `token&type`, or implicit tokens).
2. Compares invite email vs session email.
3. Displays password form only if `has_password` flag missing.
4. Calls `/api/auth/password` then `/api/invites/accept`.
5. Redirects to `/org`.

### Backend Touchpoints
- `POST /api/invites` creates internal invite record and chooses the appropriate Supabase email flow.
- `POST /api/invites/resend` replays the correct email depending on user state.
- `POST /api/invites/accept` finalizes membership (seat checks, role assignment).
- `POST /api/auth/password` sets password and marks `user_metadata.has_password`.

### Redirect URL
All emails use: `https://<your-domain>/auth/accept?inviteId=<id>&em=<email>`.

Add this URL to Supabase Auth Redirect URLs.

### After switching to implicit flow
If you previously sent invitations while using PKCE flow, those old links may fail (missing stored code_verifier). Re-send invitations so new links use token+type parameters handled by `/auth/accept`.

### Manual Test Scenarios
1. New email never used: send invite -> email -> set password -> lands in org.
2. Same email resend before confirming: resend -> new email -> set password -> org.
3. Mark user confirmed but remove `has_password` (via SQL) -> send reset path -> set password.
4. User with password: resend -> magic link -> direct org.

### Rationale
Removing intermediate callback pages eliminates token fragment loss and reduces complexity. A single, idempotent page handles every entry vector.

### Extending
Add telemetry, rate limiting, or custom HTML emails by generating `generateLink({ type:'invite' })` if desired.


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
