# Workspace Instructions

## Project
- Full-stack inventory and uniform-request MVP for a Leroy Merlin store.
- Next.js App Router, TypeScript, Tailwind CSS, Prisma and PostgreSQL.
- User-facing copy is in Brazilian Portuguese.
- Keep authentication, corporate integrations and multi-store administration out of scope until specified.

## Conventions
- Keep changes focused and follow existing Next.js and Prisma patterns.
- Preserve transaction boundaries for stock movements and request approvals.
- Never allow inventory balances to become negative.
- Do not expose secrets; use `.env` locally and keep `.env.example` generic.
- Keep `README.md` and Prisma seed data aligned with product behavior.

## Setup Progress
- [x] Workspace instructions created.
- [x] Requirements clarified and project scaffolded.
- [x] Inventory, request, approval and database features implemented.
- [x] Required extensions: none specified.
- [x] README and VS Code development task created.
- [ ] Build and runtime verification: pending Node.js/npm and PostgreSQL availability.
- [ ] Launch task: pending build prerequisites and user confirmation.
