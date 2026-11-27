# Freelance Client Portal Builder

**One clean status page per client project — so clients stop asking “where are we?” and you stop answering it in DMs.**

Build a branded portal page for any freelance project — milestones, payment schedule, what you still need from the client, latest updates, and FAQs — then export it as **one self-contained HTML file** and send it to your client by email or WhatsApp, or host it anywhere. The page works offline, forever, with no account and no expiry.

Open `index.html` in any browser. No build step, no backend, no dependencies, nothing to install.

## The problem it fills

Clients ask the same question all week: *“Where are we with the project?”* The portals that answer it live inside paid CRMs — HoneyBook, Bonsai and Dubsado start around $17/month — or inside hosted templates that expire (Stacktree's free pages last 7 days) or need an account. The free standalone tools that exist are either internal task boards for the freelancer, or single-purpose generators (a quote, a contract, an invoice) — none of them produces a page **your client** opens.

This one does, and it is free, offline, and yours: the exported page is a single file with all CSS inline, no JavaScript, no fonts, no tracking — it will still open in ten years.

## Who it helps

- **Freelancers** (web developers, designers, writers, marketers, SEO specialists) who juggle several client projects and answer the same status question every day.
- **Small agencies and studios** that want every client to see the same professional status page.
- **Any service seller** who takes deposits and milestone payments — the payment schedule on the page shows the client exactly what is paid, what is due, and when.

## Features

- **Dashboard** — all your portals at a glance: progress %, paid vs outstanding, overdue payments, and items you are still waiting on from each client.
- **Portal builder** — your business details (name, email, phone, website, brand colour), client details, project title, type, start date and currency.
- **Milestones** — ordered steps with due dates, three statuses (not started / in progress / done), deliverables and a short note for the client. Progress is calculated automatically (in-progress counts as half).
- **Payment schedule** — labelled payment lines with amounts and due dates. Overdue lines are flagged automatically; totals, paid and outstanding are computed in integer minor units, so money never drifts (Rs. 150,000 stays Rs. 150,000).
- **“What I need from you” checklist** — logins, photos, content, approvals. Items you mark received show as ticked on the client page; waiting items show as “Waiting for you”.
- **Updates log** — short dated notes, newest first, so the client can see the project moving.
- **FAQs** — questions clients always ask, answered once, shown as expandable answers.
- **Live preview** — the exact page the client gets, updating as you type.
- **Export as one HTML file** — `client-portal-<client>.html`, fully self-contained (inline CSS, no scripts, no external files). Send it or host it anywhere.
- **Print / Save as PDF** — a clean printable version of the portal page.
- **Save, duplicate, delete** — portals live in your browser's localStorage. Export/import all portals as JSON for backup or moving to another computer.
- **6 currencies** — PKR, USD, GBP, EUR, INR, AED.
- **Demo portal included** — a realistic website-redesign project for a bakery (5 milestones, 3 payments, 5 checklist items), so you can see a finished page in one click.

## How to use it

1. Open `index.html` (double-click it, or run `npm start` and open http://localhost:8000).
2. Click **Load demo portal** to see a finished example, or **+ New portal** to start from scratch.
3. Fill in your details, your client, and the project. Add milestones, payments, the things you need from the client, updates, and FAQs.
4. Watch the live preview on the right — it is exactly what the client will see.
5. Click **Download portal page (.html)** and send the file to your client. Update it and re-send whenever the project moves.

## Demo data (hand-checked)

The demo portal is a website redesign for Bright Bakery:

- 5 milestones — 2 done, 1 in progress, 2 to do → **50% complete**
- 3 payments totalling **Rs. 150,000** — Rs. 75,000 paid, Rs. 75,000 outstanding
- 5 checklist items — 3 received, 2 waiting
- Next milestone: “Online ordering + payments”, due 27 Nov 2026

See `examples/demo-portal.json` (the data) and `examples/demo-portal.html` (the exported client page).

## Project structure

```
freelance-client-portal/
├── index.html            # App shell (dashboard + editor + live preview)
├── css/
│   └── styles.css        # App styling
├── js/
│   ├── money.js          # Currencies, integer minor-unit money, dates, CSV
│   ├── store.js          # Portal data model, stats, validation, demo data
│   ├── portal.js         # Builds the standalone client-facing HTML page
│   ├── app.js            # Browser UI: dashboard, editor, preview, downloads
│   ├── money.test.js     # 33 checks
│   ├── store.test.js     # 44 checks
│   └── portal.test.js    # 40 checks (incl. HTML-escaping tests)
├── examples/
│   ├── demo-portal.json  # Demo portal data
│   └── demo-portal.html  # Exported demo client page
├── package.json
└── LICENSE               # MIT
```

## Tests

```bash
npm test
# money.test.js: 33 checks passed.
# store.test.js: 44 checks passed.
# portal.test.js: 40 checks passed.
```

All logic lives in pure modules with no DOM access, so the whole suite runs in plain Node — no test framework needed. The tests cover money math (including the no-float-drift rule), progress/payment/needs calculations, validation, and the exported page — including a hostile-input test that proves client text like `<script>alert(1)</script>` is escaped and can never break the page.

## Money safety

Money is always stored and calculated in **integer minor units** (paisa/cents). `toMinor("85,000.50")` → `8500050`; nothing is ever added as a decimal, so `0.1 + 0.2` float drift cannot corrupt a payment schedule.

## Privacy

Everything runs in your browser. No account, no server, no analytics, no tracking. Your portals live in your browser's localStorage, and the exported client page contains no scripts and phones home to nothing.

## License

MIT — free to use, modify and share.
