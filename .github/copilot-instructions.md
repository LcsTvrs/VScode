# Workspace Instructions

## Project
- Full-stack uniform inventory and request management MVP for a Leroy Merlin store.
- Next.js App Router, TypeScript, Tailwind CSS, Prisma and PostgreSQL.
- User-facing copy is in Brazilian Portuguese.
- Employee self-service requests are public at `/solicitar` and do not require login.
- LDAP/name are collected as request identity but are not validated by corporate directory integration.
- The administrator panel uses a shared environment-configured password and signed HTTP-only session; do not add unprotected admin pages or APIs.

## Conventions
- Keep changes focused and follow existing Next.js and Prisma patterns.
- Preserve transaction boundaries for stock movements and request approvals.
- Never allow inventory balances to become negative.
- Keep database credentials in the ignored local `.env`; never commit secrets.
- Keep `README.md` and Prisma seed data aligned with product behavior.

## Setup Progress
- [x] Workspace instructions, requirements and project scaffold completed.
- [x] Inventory, request, approval, API and database schema implemented.
- [x] Public LDAP/name request flow and admin LDAP visibility implemented.
- [x] Admin login, session middleware and protected APIs implemented.
- [x] Direct stock/minimum editing and audit movement implemented.
- [x] Sensitive local files ignored and HTTP security headers configured.
- [x] PostgreSQL baseline migration is tracked for Vercel deployments.
- [x] Scope and Vercel deployment documentation are present.
- [x] Dependencies installed; no additional VS Code extensions required.
- [x] `npm run lint` passed.
- [x] `npm run build` passed.
- [x] `npx prisma validate` passed.
- [x] README and VS Code development task are present.
- [x] Apply schema and seed data to `estoque_uniformes`.
- [x] Launch the app for verification at `http://localhost:3000`.
- [ ] Review 10 transitive npm audit findings before public production deployment.
