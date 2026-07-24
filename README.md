# Ad Runner

## What Ad Runner Is
Ad Runner is a spreadsheet-native, multi-network advertisement fallback router. A workbook is a publisher portfolio; every non-reserved sheet is one website; rows describe site, network, unit, placement, and candidate settings; compiled JSON powers the browser runtime.

## Why Multi-Network Fallback Matters
A slot can try ExoClick, then Adsterra, then other configured candidates, and finish with a publisher-owned house advertisement. A slot is filled only when an adapter reports `filled`.

## Quick Start
Five-minute local flow:

```bash
npm install
npm run build
npm run init
npm run dev
```

Open `http://localhost:4178/admin`, validate the workbook, publish a site, then open `http://localhost:4178/demo`. For a desktop workflow, run `python3 ad_runner_gui.py` after building.


## Python ExoClick Control Panel
Ad Runner v0.3 includes a no-dependency Tkinter desktop control panel:

```bash
npm install
npm run build
python3 ad_runner_gui.py
```

The GUI edits the existing JSON-backed `.xlsx` workbook format used by `packages/compiler/simple-xlsx.ts`; it does not replace the compiler, publisher, router, CLI, server, or workbook structure. Use the workbook selector to open `data/workbooks/ad-runner.xlsx` or another Ad Runner workbook. Select or type a website ID such as `animeplex.lol`, choose an optimization mode, select `ExoClick`, choose a standard ad name and size, paste the complete ExoClick tag, and click **Save / Update Ad**. Saving creates missing site, network, unit, and placement rows with stable slug IDs and updates the same ad on repeat saves instead of duplicating rows.

The control panel provides buttons for **Initialize Workbook**, **Validate**, **Publish**, **Status**, **Build Ad Runner**, **Start Server**, **Stop Server**, **Open Admin**, **Open Demo**, and **Copy Website Code**. Node commands are streamed into the activity log. If `dist/cli/ad-runner.js` is missing, click **Build Ad Runner** to run `npm install && npm run build`; the GUI does not install packages unless you press that button. **Start Server** launches `node dist/cli/ad-runner.js serve`, and **Stop Server** terminates only the server process started by the GUI.

A typical ExoClick setup flow is:

1. Run `npm install` and `npm run build`.
2. Run `python3 ad_runner_gui.py`.
3. Select `animeplex.lol`.
4. Select `Top Banner` and `728x90`.
5. Paste the complete ExoClick ad tag.
6. Click **Save / Update Ad**, **Validate**, **Publish**, and **Start Server**.
7. Copy the displayed integration code into your site, for example:

```html
<script
  src="http://localhost:4178/v1/ad-runner.min.js"
  data-ad-runner-site="animeplex.lol"
  data-ad-runner-base="http://localhost:4178"
  defer>
</script>

<div data-ad-runner-slot="top"></div>
```

ExoClick markup is stored exactly as pasted in the workbook. At runtime it is wrapped in a complete iframe `srcdoc` document and executed only inside a sandboxed iframe, never in the publisher page.

## Workbook Structure
Columns are exactly `block_type, block_id, field, value, aesthetic, maximum_visibility, maximum_clicks, maximum_revenue, notes`. Reserved sheets `_README`, `_TEMPLATE`, and `_GLOBAL` are ignored.

## One Website Per Sheet
Each ordinary sheet compiles independently. A failed sheet does not publish and does not replace the current live manifest.

## Adding a Network
Add `NETWORK` rows such as `adapter=simulated`, `adapter=external-tag`, `adapter=direct-sponsor`, `adapter=house-ad`, or `adapter=exoclick`.

## Adding a Unit
Add `UNIT` rows with a valid `network` reference and adapter-specific fields such as `simulated_outcome`, `image_url`, `destination_url`, `html`, `width`, and `height`.

## Creating a Fallback Chain
Add a `PLACEMENT` row with `candidates` containing comma-separated unit IDs. Candidate-specific fields like `house_top_guaranteed=true` and `exo_top_timeout_ms=1200` are supported. Legacy `unit` and `units` input is accepted with warnings, but output always uses `candidates`.

## The Four Modes
The only valid modes are `aesthetic`, `maximum-visibility`, `maximum-clicks`, and `maximum-revenue`. Old values such as `maximum-profit` and `maximum-conversion` are rejected with migration errors.

## Publishing
`ad-runner publish ./workbook.xlsx` validates, compiles, writes immutable versioned manifests, and atomically updates bootstrap JSON.

## Installing on a Website
```html
<script src="http://localhost:4178/v1/ad-runner.min.js" data-ad-runner-site="animeplex.lol" data-ad-runner-base="http://localhost:4178" defer></script>
<div data-ad-runner-slot="top"></div>
```

## Using a House Advertisement
Use the `house-ad` adapter with image, destination URL, alt text, width, height, or sanitized HTML. Mark its placement candidate as guaranteed and keep it last.

## Understanding Fill Outcomes
Adapters return `filled`, `no-fill`, `timeout`, `error`, or `unknown`. `unknown` is not counted as filled.

## Security Model
Workbook content is untrusted, public manifests omit secret values, URLs are scheme-checked, publisher HTML is sanitized, events are size-limited, raw scripts require `allow_unsafe_scripts=true`, and public endpoints serve only published manifests.

## CLI Reference
`ad-runner init`, `serve`, `validate`, `compile`, `publish`, and `status` are available via `npm run init` and `npm run dev` after building.

## HTTP Endpoint Reference
The server exposes `/v1/ad-runner.min.js`, bootstrap, manifest, health, event collection, `/admin`, workbook import, validate, publish, and rollback routes.

## Adapter Development
Implement `load`, `mount`, optional `refresh`, and optional `destroy`, then register the adapter. The router loads a network only when its candidate is attempted.

## Testing
Run `npm test` and `npm run test:e2e`.

## Current Limitations
The control panel is intentionally small, workbook upload expects raw XLSX POST data, and optimization is transparent manual ordering plus optional estimates. ExoClick defaults to filled shortly after iframe mount while preserving explicit success and failure messages when configured.
