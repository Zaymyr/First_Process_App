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

## Access Flow (Invitations Removed)

The application now only supports direct authentication (signup / recovery / magic link). All prior organization invitation mechanics and endpoints have been decommissioned.

Current behavior of `/auth/accept`:
1. Parses Supabase auth parameters (token&type, implicit access/refresh, legacy code).
2. Establishes a session client-side.
3. Requests password creation if `user_metadata.has_password != true`.
4. Updates password via `POST /api/auth/password` and redirects to `/org`.

If you had existing invitation emails, they are no longer valid. Clean up database objects by dropping any obsolete `invites` table manually if desired.

Example SQL (optional):
```sql
-- Optional cleanup (run in Supabase SQL editor only if you no longer need historical invite data)
DROP TABLE IF EXISTS invites;
```


## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
