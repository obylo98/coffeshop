# ☕ RoastRoute — Local Coffee Finder

A self-hosted Next.js app for finding the nearest coffee shops. Each user has an account, and their favourites, notes, cupping logs and preferences are saved on this machine, so they persist across restarts.

UI follows `DESIGN.md` (Warm Artisanal Roast) and the screens in `code-design.md`.

📖 **New here? Read the [User Guide & Walkthrough](GUIDE.md)** for a screen-by-screen tour.

## Run it

```bash
npm install
npm run dev                  # http://localhost:3000
# or
npm run build && npm start   # production mode
```

Open **http://localhost:3000** (not your LAN IP: browsers only share location with `localhost` or HTTPS).

## Screens

| Route | What it does |
| --- | --- |
| `/` Explore Map | Nearest cafés around you, a searched place, or your fixed home base. Filter pills (Open Now, Saved, Wi-Fi, Outdoor, < 1 km/mi), sort, map styles, "Search this area", recenter. |
| `/favorites` Saved Favorites | Your saved spots with personal notes, tags, cupping logs, map snapshot, export / import (JSON) / clear, and "Add Secret Spot" for cafés not on the map. |
| `/shop/node/123` Detail | Opening hours (today highlighted, live open/closed), amenities, contact, route map, save, share, export, and your tasting journal. |
| Directions (overlay) | In-app turn-by-turn route for walking, cycling or driving, drawn on the map, with live navigation (follows your position, highlights the next turn, re-routes if you go off course). No Google Maps. |
| `/admin` Admin Console | **Admins only.** Accounts list with usage stats; make/remove admins, reset passwords, sign users out everywhere, disable/enable or delete accounts; server stats, clear search cache, prune sessions, download a full database backup. |
| `/settings` App Settings | **Logged-in users only.** Anchor location (GPS or geocoded home base), radius, km/mi, sort, theme (Warm / Dark Espresso / Linen), map style, data management, live server diagnostics. |

## How it works

- **Café data:** OpenStreetMap. Overpass mirrors and Nominatim are queried in parallel; results are cached in memory for 10 minutes. No API keys.
- **Open now:** computed from OSM `opening_hours` (`lib/hours.js`). Unparseable values are shown as listed.
- **Directions:** `GET /api/route` proxies the free OSRM servers at routing.openstreetmap.de (FOSSGIS) for foot, bike and car profiles.
- **Accounts:** anyone can create one from **Sign up** in the header (username 3–32 chars, password 6+). scrypt-hashed passwords with a 30-day httpOnly session cookie.
- **Roles:** every account is `user` or `admin`. **The first account created on a fresh install becomes the admin**; everyone after that signs up as a regular user (the role is never taken from the request). Every `/api/admin/*` route checks the role on the server and returns 403 otherwise. Admins can't demote, disable or delete themselves, and the last active admin can't be removed. Locked out? On the host machine run `npm run admin -- list` / `npm run admin -- promote <username>`.
- **Persistence:** users, sessions, favourites, notes, cupping logs and settings live in `data/db.json`. The file is created when the server starts and written atomically on every change. Stop the server and delete it to reset. It's in `.gitignore` because it holds password hashes. Settings belong to the account; logged-out visitors use the defaults.
- **Styling:** Tailwind CSS v4 with the design tokens in `app/globals.css`; fonts are Newsreader + Plus Jakarta Sans; icons are Material Symbols.

## API

- `POST /api/auth/register|login|logout`, `GET /api/auth/me`
- `GET /api/route?from=lat,lon&to=lat,lon&mode=foot|bike|car`
- `GET /api/shops?lat=&lon=&radius=` · `GET /api/shop?id=node/123` · `GET /api/geocode?q=`
- `GET|POST|PATCH|DELETE /api/favorites` (`DELETE ?id=` or `?all=1`) · `POST /api/favorites/import` · `POST|DELETE /api/favorites/cupping`
- `GET|PUT /api/settings` · `GET /api/health` (server details for admins only)
- Admin: `GET /api/admin/overview` · `GET|PATCH|DELETE /api/admin/users` · `GET|POST /api/admin/maintenance`
