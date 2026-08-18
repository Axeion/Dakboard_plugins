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

The widget works through a fallback chain before giving up:

1. `fetch()` against `<district>.api.nutrislice.com`, then `<district>.nutrislice.com`.
2. If those are CORS-blocked, **JSONP** against the same hosts (`?format=json-p`,
   then `?format=jsonp`). A `<script>` tag isn't subject to CORS, so this often
   works with no proxy at all.
3. If everything fails, it tells you so and asks for the proxy.

Turn on `DEBUG_MODE` to see every URL tried, whether it went out as `fetch` or
`jsonp`, and how each one failed.

**"Menu not found (HTTP 404)"** means something answered, so the network and CORS
are fine and your `SCHOOL_SLUG` / `MENU_TYPE` are wrong.

**"Could not reach Nutrislice"** means nothing was readable — deploy the Worker:

1. Sign up at [workers.cloudflare.com](https://workers.cloudflare.com) (free tier is plenty).
2. Create a Worker, paste in `nutrislice-proxy-worker.js`, deploy.
3. Put the resulting `https://….workers.dev` URL into `PROXY_URL` in the widget.

The Worker only forwards requests to `*.nutrislice.com`, so it isn't an open proxy.
When `PROXY_URL` is set the widget goes straight through it and skips the JSONP
fallback, since the proxy already solves CORS.

Whichever transport succeeds is remembered, so the hourly refresh replays that
one first instead of re-failing through the dead options every time.

> JSONP works by running a script from Nutrislice's own domain in the page, so
> you are trusting that domain with the widget. That's a reasonable trade for a
> school menu on a private dashboard; use the Worker instead if you'd rather
> only ever receive data.

> Opening an API URL in a browser tab tells you the slug is right, but it does
> **not** prove CORS works — typing a URL into the address bar isn't a
> cross-origin request. Only the widget can tell you that.

## Configuration

| Setting | Default | What it does |
| --- | --- | --- |
| `DISTRICT` | `elkhornweb` | Nutrislice subdomain for your district |
| `SCHOOL_SLUG` | `elkhorn-high-school` | School segment of the menu URL |
| `MENU_TYPE` | `lunch` | Menu segment of the menu URL |
| `PROXY_URL` | `""` | Worker URL; blank means call Nutrislice directly |
| `ROLL_OVER_HOUR` | `14` | After this hour (24h), show *tomorrow's* menu. `null` = always today |
| `DATE_OVERRIDE` | `""` | Pin to one date (`YYYY-MM-DD`) while setting up |
| `TITLE` | `Lunch Menu` | Heading text; `Today's` / `Tomorrow's` is prefixed automatically |
| `SHOW_RELATIVE_DAY` | `true` | Prefix the heading with Today's/Tomorrow's |
| `SHOW_DATE` | `true` | Second heading line with the date being shown |
| `DATE_STYLE` | `long` | `long` → Tuesday, August 18; `short` → Tue, Aug 18 |
| `DEBUG_MODE` | `false` | `"items"` lists every row with the fields that decide whether it shows; `true` dumps raw JSON. On failure, either shows every URL tried |
| `SKIP_CATEGORIES` | milk, condiments | Food categories to hide. `[]` shows everything |
| `SHOW_STATIONS` | `auto` | Station headings: `auto` follows the district's own setting, `always` forces them on, `never` renders one flat list |

**Something listed that shouldn't be?** Set `DEBUG_MODE = "items"`. It prints
each row the API returned with its `food_category`, `category`, `menu_id` and
any flags (`section_title`, `blank_line`, `HIDDEN-by-category`), so you can see
exactly which field to add to `SKIP_CATEGORIES`. `DEBUG_MODE = true` dumps the
whole raw response if you need it.

The heading shows which day you're looking at, which matters because
`ROLL_OVER_HOUR` moves the menu to tomorrow in the afternoon — so the board
reads "Tomorrow's Lunch Menu / Wednesday, August 19" rather than silently
showing a different day's food.

## How it differs from the MealViewer widget

- **Per-district hosts.** Nutrislice gives every district its own subdomain, so
  the proxy takes a `host` parameter instead of a single hard-coded API host.
- **Weekly responses.** Nutrislice returns a whole week per request; the widget
  picks out the matching `date` from the `days` array using your local calendar
  date, so it doesn't drift across timezones.
- **Sections instead of blocks.** Station headings arrive as menu items flagged
  `is_section_title`, rather than MealViewer's nested `menuBlocks` →
  `cafeteriaLineList` structure. Whether a heading is *meant* to be shown lives
  separately, in the day's `menu_info` keyed by the item's `menu_id` — districts
  frequently give stations internal names (`T4-Adventure`) and set
  `use_section_title: false` to hide them. `SHOW_STATIONS: "auto"` honours that,
  and uses `display_name` as the label when the district sets one.
- **Categories instead of item types.** Filtering keys off the food's category
  (`entree`, `milk`, …) rather than MealViewer's `item_Type`.
