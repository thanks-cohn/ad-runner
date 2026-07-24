#!/usr/bin/env python3
"""Ad Runner desktop control panel for ExoClick.

The current Ad Runner workbook uses JSON internally even though the file keeps
an .xlsx extension. This tool edits that workbook safely and drives the existing
Node CLI for validation, publishing, status, and the local server.
"""

from __future__ import annotations

import json
import os
import queue
import re
import shutil
import subprocess
import threading
import webbrowser
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, scrolledtext, ttk
except ImportError as exc:  # pragma: no cover - depends on OS package
    raise SystemExit(
        "Tkinter is required. On Debian/Ubuntu install it with: sudo apt install python3-tk"
    ) from exc


COLUMNS = [
    "block_type",
    "block_id",
    "field",
    "value",
    "aesthetic",
    "maximum_visibility",
    "maximum_clicks",
    "maximum_revenue",
    "notes",
]
RESERVED_SHEETS = {"_README", "_TEMPLATE", "_GLOBAL"}
MODES = ["aesthetic", "maximum-visibility", "maximum-clicks", "maximum-revenue"]
SIZE_CHOICES = ["728x90", "970x90", "300x250", "300x600", "160x600", "320x50", "320x100"]


@dataclass(frozen=True)
class AdPreset:
    label: str
    placement_id: str
    anchor: str
    size: str
    format_name: str = "banner"


PRESETS = [
    AdPreset("Top Banner", "top-banner", "top", "728x90"),
    AdPreset("Leaderboard", "leaderboard", "leaderboard", "970x90"),
    AdPreset("Left Skyscraper", "left-skyscraper", "left-rail", "160x600"),
    AdPreset("Right Skyscraper", "right-skyscraper", "right-rail", "160x600"),
    AdPreset("Between Content", "between-content", "between-content", "728x90"),
    AdPreset("Chapter End", "chapter-end", "chapter-end", "728x90"),
    AdPreset("Rectangle", "rectangle", "in-content", "300x250"),
    AdPreset("Mobile Sticky", "mobile-sticky", "mobile-bottom", "320x50"),
    AdPreset("Popunder", "popunder", "popunder", "0x0", "popunder"),
    AdPreset("Custom", "custom-ad", "custom-ad", "300x250"),
]
PRESET_BY_LABEL = {preset.label: preset for preset in PRESETS}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.strip().lower()).strip("-")
    return slug or "ad"


def parse_size(value: str) -> tuple[int, int]:
    normalized = value.lower().replace(" ", "")
    match = re.fullmatch(r"(\d+)x(\d+)", normalized)
    if not match:
        raise ValueError("Size must look like 728x90.")
    width, height = (int(match.group(1)), int(match.group(2)))
    if width < 0 or height < 0 or width > 10000 or height > 10000:
        raise ValueError("Width and height must be between 0 and 10000.")
    return width, height


def blank_row(block_type: str, block_id: str, field: str, value: Any, notes: str = "") -> dict[str, str]:
    return {
        "block_type": block_type.upper(),
        "block_id": block_id,
        "field": field,
        "value": str(value),
        "aesthetic": "on",
        "maximum_visibility": "on",
        "maximum_clicks": "on",
        "maximum_revenue": "on",
        "notes": notes,
    }


def empty_workbook() -> dict[str, Any]:
    return {
        "SheetNames": ["_README", "_TEMPLATE"],
        "Sheets": {
            "_README": {
                "aoa": [
                    ["Ad Runner workbook"],
                    ["One ordinary sheet is one website. Use ad_runner_gui.py to add ExoClick ads."],
                ]
            },
            "_TEMPLATE": {"header": COLUMNS, "rows": []},
        },
    }


def load_workbook(path: Path) -> dict[str, Any]:
    if not path.exists():
        return empty_workbook()
    try:
        workbook = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(
            f"Could not read {path}. This release expects the Ad Runner JSON workbook format."
        ) from exc
    if not isinstance(workbook, dict) or not isinstance(workbook.get("SheetNames"), list) or not isinstance(workbook.get("Sheets"), dict):
        raise ValueError("The selected file is not a valid Ad Runner workbook.")
    return workbook


def save_workbook(path: Path, workbook: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(workbook, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def site_names(workbook: dict[str, Any]) -> list[str]:
    return [name for name in workbook.get("SheetNames", []) if name not in RESERVED_SHEETS]


def ensure_sheet(workbook: dict[str, Any], site: str) -> dict[str, Any]:
    sheets = workbook.setdefault("Sheets", {})
    names = workbook.setdefault("SheetNames", [])
    if site not in sheets:
        sheets[site] = {"header": COLUMNS, "rows": []}
        names.append(site)
    sheet = sheets[site]
    sheet.setdefault("header", COLUMNS)
    sheet.setdefault("rows", [])
    return sheet


def upsert_row(rows: list[dict[str, Any]], block_type: str, block_id: str, field: str, value: Any, notes: str = "") -> None:
    key = (block_type.upper(), block_id, field)
    for row in rows:
        current = (
            str(row.get("block_type", "")).upper(),
            str(row.get("block_id", "")),
            str(row.get("field", "")),
        )
        if current == key:
            row.update(blank_row(block_type, block_id, field, value, notes))
            return
    rows.append(blank_row(block_type, block_id, field, value, notes))


def add_exoclick_ad(
    workbook: dict[str, Any],
    *,
    site: str,
    mode: str,
    ad_name: str,
    anchor: str,
    size: str,
    ad_code: str,
    format_name: str = "banner",
) -> tuple[str, str]:
    site = site.strip()
    ad_name = ad_name.strip()
    anchor = anchor.strip()
    ad_code = ad_code.strip()
    if not site:
        raise ValueError("Enter a website name, such as animeplex.lol.")
    if mode not in MODES:
        raise ValueError(f"Mode must be one of: {', '.join(MODES)}")
    if not ad_name:
        raise ValueError("Choose or enter an ad name.")
    if not anchor:
        raise ValueError("The page anchor cannot be empty.")
    if not ad_code:
        raise ValueError("Paste the ExoClick ad code.")

    width, height = parse_size(size)
    placement_id = slugify(ad_name)
    unit_id = f"{placement_id}-exoclick"
    sheet = ensure_sheet(workbook, site)
    rows: list[dict[str, Any]] = sheet["rows"]

    site_fields = {
        "site_id": site,
        "default_mode": mode,
        "enabled": "true",
        "lazy_load": "true",
        "collapse_empty_slots": "true",
        "observe_dom": "true",
    }
    for field, value in site_fields.items():
        upsert_row(rows, "SITE", "site", field, value)

    upsert_row(rows, "NETWORK", "exoclick", "adapter", "exoclick")
    upsert_row(rows, "NETWORK", "exoclick", "enabled", "true")

    unit_fields = {
        "network": "exoclick",
        "format": format_name,
        "width": width,
        "height": height,
        "markup": ad_code,
        "assume_filled_on_mount": "true",
        "mount_grace_ms": "750",
    }
    for field, value in unit_fields.items():
        upsert_row(rows, "UNIT", unit_id, field, value)

    placement_fields = {
        "anchor": anchor,
        "candidates": unit_id,
        "priority": "100",
        "timeout_ms": "5000",
    }
    for field, value in placement_fields.items():
        upsert_row(rows, "PLACEMENT", placement_id, field, value)

    return placement_id, unit_id


class AdRunnerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Ad Runner - ExoClick Control Panel")
        self.geometry("930x760")
        self.minsize(780, 650)

        self.root_dir = Path(__file__).resolve().parent
        self.workbook_path = Path(
            os.environ.get("AD_RUNNER_WORKBOOK", self.root_dir / "data" / "workbooks" / "ad-runner.xlsx")
        ).expanduser()
        self.workbook: dict[str, Any] = empty_workbook()
        self.process_queue: queue.Queue[str] = queue.Queue()
        self.server_process: subprocess.Popen[str] | None = None
        self.busy = False

        self._build_ui()
        self._load_selected_workbook(show_errors=False)
        self.after(100, self._drain_process_queue)
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _build_ui(self) -> None:
        outer = ttk.Frame(self, padding=14)
        outer.pack(fill="both", expand=True)
        outer.columnconfigure(1, weight=1)
        outer.rowconfigure(8, weight=1)

        ttk.Label(outer, text="Workbook").grid(row=0, column=0, sticky="w", padx=(0, 10), pady=5)
        self.workbook_var = tk.StringVar(value=str(self.workbook_path))
        ttk.Entry(outer, textvariable=self.workbook_var).grid(row=0, column=1, sticky="ew", pady=5)
        ttk.Button(outer, text="Browse", command=self._browse_workbook).grid(row=0, column=2, padx=(10, 0), pady=5)

        ttk.Label(outer, text="Website").grid(row=1, column=0, sticky="w", padx=(0, 10), pady=5)
        self.site_var = tk.StringVar(value="animeplex.lol")
        self.site_combo = ttk.Combobox(outer, textvariable=self.site_var, state="normal")
        self.site_combo.grid(row=1, column=1, sticky="ew", pady=5)

        ttk.Label(outer, text="Mode").grid(row=1, column=2, sticky="w", padx=(10, 0), pady=5)
        self.mode_var = tk.StringVar(value="maximum-revenue")
        ttk.Combobox(outer, textvariable=self.mode_var, values=MODES, state="readonly", width=21).grid(
            row=1, column=3, sticky="ew", pady=5
        )

        ttk.Label(outer, text="Ad name").grid(row=2, column=0, sticky="w", padx=(0, 10), pady=5)
        self.ad_name_var = tk.StringVar(value=PRESETS[0].label)
        self.ad_name_combo = ttk.Combobox(
            outer, textvariable=self.ad_name_var, values=[preset.label for preset in PRESETS], state="normal"
        )
        self.ad_name_combo.grid(row=2, column=1, sticky="ew", pady=5)
        self.ad_name_combo.bind("<<ComboboxSelected>>", self._preset_changed)

        ttk.Label(outer, text="Size").grid(row=2, column=2, sticky="w", padx=(10, 0), pady=5)
        self.size_var = tk.StringVar(value=PRESETS[0].size)
        ttk.Combobox(outer, textvariable=self.size_var, values=SIZE_CHOICES, state="normal", width=21).grid(
            row=2, column=3, sticky="ew", pady=5
        )

        ttk.Label(outer, text="Page anchor").grid(row=3, column=0, sticky="w", padx=(0, 10), pady=5)
        self.anchor_var = tk.StringVar(value=PRESETS[0].anchor)
        ttk.Entry(outer, textvariable=self.anchor_var).grid(row=3, column=1, sticky="ew", pady=5)
        ttk.Label(outer, text='Matches data-ad-runner-slot="..."').grid(
            row=3, column=2, columnspan=2, sticky="w", padx=(10, 0), pady=5
        )

        ttk.Label(outer, text="ExoClick ad code").grid(row=4, column=0, sticky="nw", padx=(0, 10), pady=(8, 5))
        self.code_text = scrolledtext.ScrolledText(outer, height=15, wrap="word", font=("TkFixedFont", 10))
        self.code_text.grid(row=4, column=1, columnspan=3, sticky="nsew", pady=(8, 5))
        outer.rowconfigure(4, weight=2)

        primary = ttk.Frame(outer)
        primary.grid(row=5, column=0, columnspan=4, sticky="ew", pady=(10, 5))
        for column in range(5):
            primary.columnconfigure(column, weight=1)
        self.save_button = ttk.Button(primary, text="Save / Update Ad", command=self._save_ad)
        self.save_button.grid(row=0, column=0, sticky="ew", padx=(0, 5))
        ttk.Button(primary, text="Validate", command=lambda: self._run_cli("validate")).grid(
            row=0, column=1, sticky="ew", padx=5
        )
        ttk.Button(primary, text="Publish", command=lambda: self._run_cli("publish")).grid(
            row=0, column=2, sticky="ew", padx=5
        )
        ttk.Button(primary, text="Status", command=lambda: self._run_cli("status")).grid(
            row=0, column=3, sticky="ew", padx=5
        )
        self.server_button = ttk.Button(primary, text="Start Server", command=self._toggle_server)
        self.server_button.grid(row=0, column=4, sticky="ew", padx=(5, 0))

        secondary = ttk.Frame(outer)
        secondary.grid(row=6, column=0, columnspan=4, sticky="ew", pady=5)
        ttk.Button(secondary, text="Open Admin", command=lambda: webbrowser.open("http://localhost:4178/admin")).pack(
            side="left"
        )
        ttk.Button(secondary, text="Open Demo", command=lambda: webbrowser.open("http://localhost:4178/demo")).pack(
            side="left", padx=8
        )
        ttk.Button(secondary, text="Reload Workbook", command=self._load_selected_workbook).pack(side="left")

        ttk.Label(outer, text="Activity").grid(row=7, column=0, sticky="nw", padx=(0, 10), pady=(8, 5))
        self.log_text = scrolledtext.ScrolledText(outer, height=10, wrap="word", state="disabled", font=("TkFixedFont", 9))
        self.log_text.grid(row=7, column=1, columnspan=3, sticky="nsew", pady=(8, 0))
        outer.rowconfigure(7, weight=1)

    def _log(self, text: str) -> None:
        self.log_text.configure(state="normal")
        self.log_text.insert("end", text.rstrip() + "\n")
        self.log_text.see("end")
        self.log_text.configure(state="disabled")

    def _preset_changed(self, _event: object | None = None) -> None:
        preset = PRESET_BY_LABEL.get(self.ad_name_var.get())
        if preset:
            self.size_var.set(preset.size)
            self.anchor_var.set(preset.anchor)

    def _browse_workbook(self) -> None:
        selected = filedialog.askopenfilename(
            title="Select Ad Runner workbook",
            initialdir=str(self.workbook_path.parent),
            filetypes=[("Ad Runner workbook", "*.xlsx"), ("JSON", "*.json"), ("All files", "*")],
        )
        if selected:
            self.workbook_var.set(selected)
            self._load_selected_workbook()

    def _load_selected_workbook(self, show_errors: bool = True) -> None:
        try:
            self.workbook_path = Path(self.workbook_var.get()).expanduser().resolve()
            self.workbook = load_workbook(self.workbook_path)
            names = site_names(self.workbook)
            self.site_combo.configure(values=names)
            if names and (not self.site_var.get() or self.site_var.get() == "animeplex.lol"):
                self.site_var.set(names[0])
            self._log(f"Loaded workbook: {self.workbook_path}")
        except ValueError as exc:
            if show_errors:
                messagebox.showerror("Workbook error", str(exc))
            self._log(str(exc))

    def _save_ad(self) -> None:
        try:
            preset = PRESET_BY_LABEL.get(self.ad_name_var.get())
            placement_id, unit_id = add_exoclick_ad(
                self.workbook,
                site=self.site_var.get(),
                mode=self.mode_var.get(),
                ad_name=self.ad_name_var.get(),
                anchor=self.anchor_var.get(),
                size=self.size_var.get(),
                ad_code=self.code_text.get("1.0", "end"),
                format_name=preset.format_name if preset else "banner",
            )
            save_workbook(self.workbook_path, self.workbook)
            names = site_names(self.workbook)
            self.site_combo.configure(values=names)
            self._log(
                f"Saved ExoClick ad '{placement_id}' as unit '{unit_id}' for {self.site_var.get()}."
            )
            messagebox.showinfo(
                "Ad saved",
                f"Saved {self.ad_name_var.get()} for {self.site_var.get()}.\n\n"
                f'Website slot: <div data-ad-runner-slot="{self.anchor_var.get().strip()}"></div>',
            )
        except ValueError as exc:
            messagebox.showerror("Could not save ad", str(exc))

    def _node_command(self, command: str) -> list[str]:
        node = shutil.which("node")
        if not node:
            raise RuntimeError("Node.js is required to validate, publish, or run Ad Runner.")
        cli = self.root_dir / "dist" / "cli" / "ad-runner.js"
        if not cli.exists():
            raise RuntimeError("Ad Runner is not built yet. Run npm install, then npm run build.")
        args = [node, str(cli), command]
        if command in {"validate", "publish", "compile"}:
            args.append(str(self.workbook_path))
        return args

    def _run_cli(self, command: str) -> None:
        if self.busy:
            self._log("Another command is already running.")
            return
        try:
            args = self._node_command(command)
        except RuntimeError as exc:
            messagebox.showerror("Cannot run command", str(exc))
            return
        self.busy = True
        self._log(f"$ {' '.join(args)}")

        def worker() -> None:
            try:
                completed = subprocess.run(
                    args,
                    cwd=self.root_dir,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                    check=False,
                )
                self.process_queue.put(completed.stdout or "(no output)")
                self.process_queue.put(f"__DONE__:{completed.returncode}")
            except OSError as exc:
                self.process_queue.put(f"Command failed: {exc}")
                self.process_queue.put("__DONE__:1")

        threading.Thread(target=worker, daemon=True).start()

    def _toggle_server(self) -> None:
        if self.server_process and self.server_process.poll() is None:
            self.server_process.terminate()
            self.server_process = None
            self.server_button.configure(text="Start Server")
            self._log("Server stopped.")
            return
        try:
            args = self._node_command("serve")
        except RuntimeError as exc:
            messagebox.showerror("Cannot start server", str(exc))
            return
        self._log(f"$ {' '.join(args)}")
        try:
            self.server_process = subprocess.Popen(
                args,
                cwd=self.root_dir,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
            )
        except OSError as exc:
            messagebox.showerror("Cannot start server", str(exc))
            return
        self.server_button.configure(text="Stop Server")

        def reader() -> None:
            assert self.server_process is not None
            if self.server_process.stdout:
                for line in self.server_process.stdout:
                    self.process_queue.put(line)
            code = self.server_process.wait()
            self.process_queue.put(f"Server exited with code {code}.")
            self.process_queue.put("__SERVER_STOPPED__")

        threading.Thread(target=reader, daemon=True).start()

    def _drain_process_queue(self) -> None:
        try:
            while True:
                item = self.process_queue.get_nowait()
                if item.startswith("__DONE__:"):
                    code = int(item.split(":", 1)[1])
                    self.busy = False
                    self._log("Command completed successfully." if code == 0 else f"Command exited with code {code}.")
                elif item == "__SERVER_STOPPED__":
                    self.server_process = None
                    self.server_button.configure(text="Start Server")
                else:
                    self._log(item)
        except queue.Empty:
            pass
        self.after(100, self._drain_process_queue)

    def _on_close(self) -> None:
        if self.server_process and self.server_process.poll() is None:
            self.server_process.terminate()
        self.destroy()


def main() -> int:
    app = AdRunnerApp()
    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
