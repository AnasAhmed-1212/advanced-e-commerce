This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Connect PostgreSQL

The server already uses PostgreSQL through `pg` in `app/lib/db.ts`. No additional database driver or ORM is needed.

1. Open `.env.local` in the project root, beside `package.json`. If it is missing, copy `.env.example` to `.env.local`.
2. Paste your PostgreSQL connection string into `DATABASE_URL`:

   ```dotenv
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
   ```

   Use the full connection string supplied by your database provider, including its TLS query parameters. URL-encode special characters in credentials. Next.js expands `$VARIABLE` in env files, so escape literal dollar signs as `\$`. Keep `DATABASE_SSL=false` when TLS is configured by the URL or when using local PostgreSQL; the current `true` override disables certificate verification.
3. Initialize or upgrade the database:

   ```bash
   npm run db:migrate
   ```

   The runner applies migrations in a transaction, records checksums, and skips completed migrations. It also recognizes an existing foundation schema from migrations 001 and 002. Migration 003 adds categories, compressed image storage, image ordering, stock allocations, and payment settings. Existing products and orders are preserved. Run migrations before starting a new deployment.
4. To enable customer accounts, generate a random session secret and paste it into `CUSTOMER_SESSION_SECRET`:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

5. Restart the development server after editing `.env.local`.

Admin login additionally requires `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and a separate `ADMIN_SESSION_SECRET` of at least 32 characters. Generate that secret with the command above. To generate the password hash, use a password of at least 12 characters:

```bash
# Bash: enter your password without saving it in shell history.
read -r -s -p "Admin password: " ADMIN_PASSWORD_PLAIN
echo
export ADMIN_PASSWORD_PLAIN
npm run admin:hash-password
unset ADMIN_PASSWORD_PLAIN
```

Paste the resulting `salt:hash` into `ADMIN_PASSWORD_HASH`. Do not put the plaintext password in `.env.local`.

`.env.local` is ignored by Git; `.env.example` contains only empty values and can be committed. Keep database credentials server-side under `DATABASE_URL`, without a `NEXT_PUBLIC_` prefix. For deployment, set these variables in the hosting provider's environment settings.

Connecting an empty database does not populate the catalog or stock. Create categories and products in `/admin`. Internal inventory references are generated automatically; you do not enter SKUs. Products from an earlier schema must be edited to add a category, description and images before publishing them to the live catalog.

### Manage the store

- **Categories:** create, edit or hide categories with names, URL slugs, descriptions and a cover image. Empty categories can be deleted. Hiding a category also hides its products from the storefront and checkout.
- **Products:** create and edit products with a category, description, PKR price, stock and up to ten images. Drag gallery images or use the arrow buttons to reorder them. The first image becomes the cover. Save as a draft, publish, or archive to remove a product from sale while retaining its order history.
- **Images:** JPEG, PNG, WebP and AVIF uploads are decoded and validated on the server, rotated, resized to fit within 1600 × 1600 pixels, stripped of metadata and compressed to WebP. Large outputs receive additional resizing and compression to reduce storage and transfer size. Inputs are limited to 12 MB and 40 megapixels; saved images are limited to 2 MB. Images are stored durably in PostgreSQL and included in database backups. No local upload folder or additional storage credentials are required.
- **Orders:** view delivery details and ordered items, confirm payments, and update fulfillment. Checkout reserves stock transactionally. Delivery deducts stock, cancellation releases reservations, and returns restore delivered inventory. Repeated updates do not restore inventory twice.
- **Payments:** cash on delivery is available. In **Admin → Payments**, add your receiving account title, Raast ID/account number/IBAN, bank and instructions, then enable Raast. Until configured, Raast is hidden at checkout. Customers send money directly, submit a transfer reference, and wait for manual verification. Check your bank account before marking the order paid; there is no automatic bank verification or card gateway.
- **Product browsing:** five cards per row on desktop, three on tablets and two on mobile. Product photos zoom toward the pointer; the enlarge button opens a keyboard-accessible image viewer. Saved items and recently viewed products are retained in the current browser.
- **Product details:** vertical thumbnails, cursor zoom, an expandable gallery, stock-aware quantities, Buy now, wishlist, sharing, related items and recently viewed items use published catalog records. Buy now adds the selected quantity and opens checkout. **Make an offer / Enquire** opens WhatsApp with the product and quantity for a discussion with the store. Add model, compatibility, included accessories and warranty information to each product's admin description to show those details to shoppers.

Published products, categories, descriptions, prices, stock and images are read from PostgreSQL throughout the storefront and checkout. Customer accounts retain order history. Checkout validates prices and stock on the server and reuses an idempotency key when retrying a submission.

### Gemini equipment assistant

The floating chat button is available on customer pages and hidden in admin. Add your Gemini key directly to `.env.local` (or your hosting provider's secret settings), then restart Next.js:

```dotenv
GEMINI_API_KEY="your_gemini_api_key"
GEMINI_MODEL="gemini-3.6-flash"
CHATBOT_TRUST_PROXY=false
```

Keep the key server-only; do not use a `NEXT_PUBLIC_` prefix or put it in a chat message. The model is configurable to one supported by your Google project. The implementation uses Google's supported [generateContent REST API](https://ai.google.dev/api/generate-content) with structured JSON output. Without a key, the panel works and gives a clear unavailable message; it does not pretend to generate AI replies.

The assistant is configured with a store playbook and fresh catalog context, rather than a separately fine-tuned Gemini model. Instructions are in `app/lib/chatbot-policy.ts`. Each request retrieves up to 20 relevant published products using English/Urdu equipment aliases and recent questions, along with current checkout/payment availability. New admin products and edits are available without retraining. Recommendations link only to verified catalog records; card prices and stock come from the database. Order history and receiving bank details are not sent to Gemini.

It supports English, Urdu script and Roman Urdu, PKR budgets, nebulizers, BP monitors, glucometers and recurring accessory costs. It asks about fit, use and compatibility; does not invent specifications, delivery promises, return policies, clinical validation or DRAP approvals; and directs diagnoses, medicines and concerning symptoms to clinicians. Nebulizer advice follows the device manual and prescriber's instructions. General device-use guidance was checked against [CDC blood pressure measurement advice](https://www.cdc.gov/high-blood-pressure/measure/index.html), [FDA glucose meter guidance](https://www.fda.gov/medical-devices/in-vitro-diagnostics/blood-glucose-monitoring-devices), and [Asthma + Lung UK nebulizer guidance](https://www.asthmaandlung.org.uk/symptoms-tests-treatments/treatments/nebulisers). These sources guide general education and do not certify individual products sold here.

A narrow English/Urdu/Roman Urdu emergency-phrase check returns an urgent-care message with no product recommendations before contacting Gemini, including when no key is configured. It is not a comprehensive symptom checker; other clinical concerns are handled by the assistant's instructions and should be directed to qualified clinicians.

For better answers, add accurate product descriptions in admin: exact model/brand, cuff size or mask sizes, power requirements, included parts, strip model compatibility, operating/storage conditions, verified warranty terms and manufacturer documentation. Missing information is treated as unknown. Update the playbook when store policies change. Before choosing a different Gemini model, review sample English/Urdu conversations covering unavailable products, mismatched strips, medicine requests, urgent symptoms and requests to ignore instructions; AI responses still need ongoing review.

Only the most recent five completed exchanges and the new question are sent with each request. Chat stays in page memory and is cleared by **Start a new chat** or reload; the application does not write transcripts to the database or browser storage. Google processes the submitted messages under your Gemini project's terms. The panel tells customers to avoid private health or banking details. Responses are rendered as text, not executable HTML.

Requests have byte/message limits, same-origin checks, a 30-second provider timeout, and per-process limits of 20 requests per five minutes, 120 per hour and three simultaneous requests. By default the five-minute bucket is shared. Set `CHATBOT_TRUST_PROXY=true` only behind a proxy that overwrites incoming `X-Forwarded-For`; this enables hashed IP buckets without retaining raw addresses. Across multiple server instances, apply a shared gateway/WAF limit and Google project usage controls. Provider errors are sanitized; keys and upstream error bodies are not sent to the browser. There is no automatic retry that could repeatedly spend API quota.

### Verify changes

```bash
npm run build
npm run test:commerce
npm run test:chatbot
```

The commerce checks start a temporary production server and use Playwright with an installed Chrome or Edge browser on Windows (or Playwright's Chromium on other systems). They create a separate, temporary PostgreSQL schema, exercise the admin and customer purchase flows, and remove the schema afterward. The database role needs permission to create schemas. Store data and payment settings are unchanged. Screenshots are saved under the ignored `test-results/` directory. Set `COMMERCE_BROWSER_PATH` if your browser is installed elsewhere.

The chatbot checks use read-only catalog queries, synthetic policy fixtures and a simulated Gemini provider in a child process. They verify request boundaries, catalog links, missing-key/provider failures, request limits, Urdu RTL, keyboard behavior and mobile layout without sending messages to Google or spending Gemini quota. They require a completed build, the configured database and the same browser setup. They do not verify real model answer quality; review that separately with your own configured key.

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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

1. Import this repository with the **Next.js** framework preset. Use `npm run build` and the default output directory.
2. In Supabase, open **Connect** and copy the **Transaction pooler** PostgreSQL URI (port `6543`). Copy the exact host and username provided there; the pooler username normally includes the project reference. Insert your database password, URL-encoding special characters. Supabase recommends transaction pooling for serverless connections; the direct host may require IPv6.
3. In Vercel **Project → Settings → Environment Variables**, add `DATABASE_URL` with that complete URI for **Production**, and for **Preview** if needed. Paste the value without surrounding quotes. Keep the provider's TLS parameters and leave `DATABASE_SSL=false` when TLS is configured in the URI.
4. Add the other values from your local environment: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, `CUSTOMER_SESSION_SECRET`, `GEMINI_API_KEY`, and `GEMINI_MODEL`. These enable admin login, customer accounts, and the assistant. Never prefix secrets with `NEXT_PUBLIC_`. Your ignored `.env.local` is not automatically uploaded.
5. If this points to a new database, apply the migrations with `npm run db:migrate` from a trusted local environment configured for that database. An existing migrated Supabase database does not need to be recreated.
6. **Redeploy** after changing environment variables; they apply to new deployments.

If the storefront displays “We’ll be right back”, refresh it and inspect **Vercel → Logs** for `Catalog database request failed`. The log includes a diagnostic code and, for DNS lookup failures, the hostname that failed. Passwords and connection strings are never logged:

| Code | What to check |
| --- | --- |
| `DATABASE_NOT_CONFIGURED` | Add `DATABASE_URL` for the deployment's environment and redeploy. |
| `ENETUNREACH`, `ENOTFOUND`, `ETIMEDOUT`, `ECONNREFUSED` | Verify the exact pooler host/port, database availability, and network restrictions. |
| `28P01` | Verify the database password and the pooler username; encode special characters in URI credentials. |
| `42P01`, `42703` | The configured database is missing a required table or column; apply the project migrations. |
| Certificate-related code | Check the provider's TLS settings and certificate configuration. |

Sources: [Supabase database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [Vercel environment variables](https://vercel.com/docs/environment-variables).
