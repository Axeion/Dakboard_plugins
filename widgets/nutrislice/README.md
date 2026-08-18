# Nutrislice School Lunch Menu

A DakBoard widget block that shows today's school lunch menu from
[Nutrislice](https://www.nutrislice.com/). It's the Nutrislice counterpart to
the `mealviewer` widget in this repo — many districts have moved from
MealViewer to Nutrislice, and the two use completely different APIs.

## Files

| File | What it's for |
| --- | --- |
| `dakboard-nutrislice-widget.html` | Paste into a DakBoard **Widget Block** |
| `nutrislice-proxy-worker.js` | Optional Cloudflare Worker, only if you hit a CORS error |

## Setup

### 1. Find your district, school and menu type

Open your school's menu on the Nutrislice site and read all three off the URL:

```
https://elkhornweb.nutrislice.com/menu/elkhorn-high-school/lunch/2026-08-19
        └────────┘                     └─────────────────┘ └───┘
        DISTRICT                       SCHOOL_SLUG         MENU_TYPE
```

`MENU_TYPE` is **not always `lunch`** — districts name their menus things like
`hs-lunch`, `lunch-2` or `secondary-lunch`. Always copy it from the URL.

If you can't find the school's page, this lists every school in a district
along with its slug:

```
https://<DISTRICT>.nutrislice.com/menu/api/schools/?format=json
```

### 2. Add the widget

1. On your DakBoard Custom Screen: **Add a Block → Widget Block**.
2. Paste the entire contents of `dakboard-nutrislice-widget.html`.
3. Edit the `CONFIG` block at the top of the `<script>` section.
4. Resize the block on your layout.

### 3. If the menu never loads

Open the browser console. A **CORS error** means Nutrislice refused the direct
browser request. Deploy the companion Worker:

1. Sign up at [workers.cloudflare.com](https://workers.cloudflare.com) (free tier is plenty).
2. Create a Worker, paste in `nutrislice-proxy-worker.js`, deploy.
3. Put the resulting `https://….workers.dev` URL into `PROXY_URL` in the widget.

The Worker only forwards requests to `*.nutrislice.com`, so it isn't an open proxy.

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `DISTRICT` | `elkhornweb` | Nutrislice subdomain for your district |
| `SCHOOL_SLUG` | `elkhorn-high-school` | School segment of the menu URL |
| `MENU_TYPE` | `lunch` | Menu segment of the menu URL |
| `PROXY_URL` | `""` | Worker URL; blank means call Nutrislice directly |
| `ROLL_OVER_HOUR` | `14` | After this hour (24h), show *tomorrow's* menu. `null` = always today |
| `DATE_OVERRIDE` | `""` | Pin to one date (`YYYY-MM-DD`) while setting up |
| `DEBUG_MODE` | `false` | Dump the raw API response on screen |
| `SKIP_CATEGORIES` | milk, condiments | Food categories to hide. `[]` shows everything |

**Setting up? Turn on `DEBUG_MODE` first.** It prints the raw response, which is
the quickest way to confirm your district/school/menu values are right and to
see the exact category names your district uses for `SKIP_CATEGORIES`.

## How it differs from the MealViewer widget

- **Per-district hosts.** Nutrislice gives every district its own subdomain, so
  the proxy takes a `host` parameter instead of a single hard-coded API host.
- **Weekly responses.** Nutrislice returns a whole week per request; the widget
  picks out the matching `date` from the `days` array using your local calendar
  date, so it doesn't drift across timezones.
- **Sections instead of blocks.** Station headings arrive as menu items flagged
  `is_section_title`, rather than MealViewer's nested `menuBlocks` →
  `cafeteriaLineList` structure.
- **Categories instead of item types.** Filtering keys off the food's category
  (`entree`, `milk`, …) rather than MealViewer's `item_Type`.
