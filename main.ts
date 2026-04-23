import { App, Plugin, Modal, TFile } from "obsidian";
import * as path from "path";
import * as fs from "fs";

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class PdfToMdPlugin extends Plugin {
  async onload() {
    // Right-click any PDF in the file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") return;
        menu.addItem((item) =>
          item
            .setTitle("Convert to Markdown")
            .setIcon("file-text")
            .onClick(() => new ConvertModal(this.app, file).open())
        );
      })
    );

    // Command palette: works when a PDF is the active file
    this.addCommand({
      id: "convert-active-pdf",
      name: "Convert active PDF to Markdown",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension.toLowerCase() === "pdf") {
          if (!checking) new ConvertModal(this.app, file).open();
          return true;
        }
        return false;
      },
    });
  }
}

// ─── Modal ────────────────────────────────────────────────────────────────────

class ConvertModal extends Modal {
  private file: TFile;
  private nameInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private convertBtn: HTMLButtonElement;

  constructor(app: App, file: TFile) {
    super(app);
    this.file = file;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("pcm-root");

    // ── Header: icon + source filename ──
    const hero = contentEl.createDiv("pcm-hero");

    const iconEl = hero.createDiv("pcm-icon");
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
        width="22" height="22">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`;

    const meta = hero.createDiv("pcm-meta");
    meta.createEl("div", { cls: "pcm-source-label", text: "Source" });
    meta.createEl("div", { cls: "pcm-source-name", text: this.file.name });

    // ── Output filename input ──
    const fieldWrap = contentEl.createDiv("pcm-field");
    fieldWrap.createEl("label", { cls: "pcm-label", text: "Save as", attr: { for: "pcm-name" } });

    const inputRow = fieldWrap.createDiv("pcm-input-row");
    this.nameInput = inputRow.createEl("input", {
      cls: "pcm-input",
      attr: { id: "pcm-name", type: "text", spellcheck: "false" },
    });
    this.nameInput.value = this.file.basename;
    inputRow.createEl("span", { cls: "pcm-ext", text: ".md" });

    // Select all on focus so the user can rename immediately
    this.nameInput.addEventListener("focus", () => this.nameInput.select());

    // ── Status bar ──
    this.statusEl = contentEl.createDiv("pcm-status pcm-status-idle");
    this.statusEl.textContent = "Ready";

    // ── Action buttons ──
    const actions = contentEl.createDiv("pcm-actions");

    this.convertBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-primary", text: "Convert" });
    this.convertBtn.onclick = () => this.runConvert();

    // Allow Enter key to trigger conversion
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });

    const cancelBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-secondary", text: "Cancel" });
    cancelBtn.onclick = () => this.close();

    // Auto-focus the input
    setTimeout(() => this.nameInput.focus(), 50);
  }

  private async runConvert() {
    // Validate filename
    const rawName = this.nameInput.value.trim();
    if (!rawName) {
      this.setStatus("error", "Please enter a filename");
      this.nameInput.focus();
      return;
    }
    if (/[/\\:*?"<>|]/.test(rawName)) {
      this.setStatus("error", 'Name contains invalid characters: / \\ : * ? " < > |');
      this.nameInput.focus();
      return;
    }

    this.convertBtn.disabled = true;
    this.nameInput.disabled = true;
    this.setStatus("converting", "Converting…");

    try {
      const vaultPath = (this.app.vault.adapter as any).basePath as string;
      const pdfAbs    = path.join(vaultPath, this.file.path);

      // Convert — library writes <basename>.md into outputDir
      const { convert } = await import("@opendataloader/pdf");
      await convert([pdfAbs], { outputDir: vaultPath, format: "markdown" });

      // Rename to the user's chosen name if it differs from the default
      const defaultMd = path.join(vaultPath, this.file.basename + ".md");
      const targetMd  = path.join(vaultPath, rawName + ".md");

      if (defaultMd !== targetMd) {
        if (fs.existsSync(defaultMd)) {
          fs.renameSync(defaultMd, targetMd);
        }
      }

      // Refresh vault so the new file appears in the file tree
      await this.app.vault.adapter.list("/").catch(() => {});

      this.setStatus("done", `Saved as ${rawName}.md`);
      setTimeout(() => this.close(), 1800);
    } catch (e: any) {
      this.setStatus("error", e.message ?? "Conversion failed");
      this.convertBtn.disabled = false;
      this.nameInput.disabled = false;
      this.convertBtn.textContent = "Retry";
    }
  }

  private setStatus(type: "idle" | "converting" | "done" | "error", text: string) {
    this.statusEl.className = `pcm-status pcm-status-${type}`;
    if (type === "converting") {
      this.statusEl.innerHTML = `<span class="pcm-spinner"></span><span>${text}</span>`;
    } else {
      this.statusEl.textContent = text;
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
