import { App, Plugin, Modal, TFile, Notice, PluginSettingTab, Setting } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import { execSync, spawn } from "child_process";

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class PdfToMdPlugin extends Plugin {
  private pluginDir = "";
  settings: PdfToMdSettings;

  async onload() {
    await this.loadSettings();
    this.pluginDir = getPluginDir(this.app, this.manifest);
    this.addSettingTab(new PdfToMdSettingTab(this.app, this));

    // Right-click any PDF in the file explorer
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") return;
        menu.addItem((item) =>
          item
            .setTitle("Convert to Markdown")
            .setIcon("file-text")
            .onClick(() => new ConvertModal(this.app, file, this.pluginDir, this.settings).open())
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
          if (!checking) new ConvertModal(this.app, file, this.pluginDir, this.settings).open();
          return true;
        }
        return false;
      },
    });

    // Alternative: Add context menu for file explorer
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const pdfFiles = files.filter(f => f instanceof TFile && f.extension.toLowerCase() === "pdf");
        if (pdfFiles.length === 1) {
          const pdfFile = pdfFiles[0] as TFile;
          menu.addItem((item) =>
            item
              .setTitle("Convert to Markdown")
              .setIcon("file-text")
              .onClick(() => new ConvertModal(this.app, pdfFile, this.pluginDir, this.settings).open())
          );
        }
      })
    );
  }

  async loadSettings() {
    this.settings = normalizeSettings(Object.assign({}, DEFAULT_SETTINGS, await this.loadData()));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ─── Conversion Modes ────────────────────────────────────────────────────────

interface PdfToMdSettings {
  defaultMode: string;
  hybridUrl: string;
  hybridTimeout: string;
  hybridFallback: boolean;
  hybridOcr: boolean;
  hybridOcrLang: string;
  hybridFormula: boolean;
  hybridPicture: boolean;
}

const DEFAULT_SETTINGS: PdfToMdSettings = {
  defaultMode: "fast",
  hybridUrl: "http://localhost:5002",
  hybridTimeout: "0",
  hybridFallback: false,
  hybridOcr: false,
  hybridOcrLang: "ch_sim,en",
  hybridFormula: false,
  hybridPicture: false
};

interface ConversionMode {
  id: string;
  name: string;
  description: string;
  options: any;
  requiresHybrid?: boolean;
}

const CONVERSION_MODES: ConversionMode[] = [
  {
    id: "fast",
    name: "Fast",
    description: "Java-only conversion for standard digital PDFs. No backend required.",
    options: {
      format: "markdown",
      hybrid: "off"
    }
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Uses the local OpenDataLoader hybrid backend for complex layouts and tables.",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "auto",
      hybridUrl: "http://localhost:5002",
      hybridTimeout: "0",
      hybridFallback: true,
      tableMethod: "cluster"
    },
    requiresHybrid: true
  }
];

function getMode(id: string): ConversionMode {
  return CONVERSION_MODES.find((mode) => mode.id === id) || CONVERSION_MODES[0];
}

function normalizeSettings(settings: PdfToMdSettings): PdfToMdSettings {
  if (!CONVERSION_MODES.some((mode) => mode.id === settings.defaultMode)) {
    settings.defaultMode = DEFAULT_SETTINGS.defaultMode;
  }
  if (!settings.hybridUrl) settings.hybridUrl = DEFAULT_SETTINGS.hybridUrl;
  if (!settings.hybridTimeout) settings.hybridTimeout = DEFAULT_SETTINGS.hybridTimeout;
  if (!settings.hybridOcrLang) settings.hybridOcrLang = DEFAULT_SETTINGS.hybridOcrLang;
  return settings;
}

function getHybridPort(settings: PdfToMdSettings): string {
  try {
    return new URL(settings.hybridUrl).port || "5002";
  } catch (e) {
    return "5002";
  }
}

interface HybridEnhancements {
  ocr: boolean;
  formula: boolean;
  picture: boolean;
}

function getHybridServerCommand(
  mode: ConversionMode,
  settings: PdfToMdSettings,
  enhancements: HybridEnhancements = getDefaultHybridEnhancements(settings)
): string | null {
  if (!mode.requiresHybrid) return null;

  const args = [`opendataloader-pdf-hybrid --port ${getHybridPort(settings)}`];
  if (enhancements.ocr) args.push(`--force-ocr --ocr-lang "${settings.hybridOcrLang}"`);
  if (enhancements.formula) args.push("--enrich-formula");
  if (enhancements.picture) args.push("--enrich-picture-description");
  return args.join(" ");
}

function describeMode(mode: ConversionMode, settings: PdfToMdSettings): string {
  const command = getHybridServerCommand(mode, settings);
  return command ? `${mode.description} Start backend: ${command}` : mode.description;
}

function getDefaultHybridEnhancements(settings: PdfToMdSettings): HybridEnhancements {
  return {
    ocr: settings.hybridOcr,
    formula: settings.hybridFormula,
    picture: settings.hybridPicture
  };
}

function getConversionOptions(
  mode: ConversionMode,
  settings: PdfToMdSettings,
  outputDir: string,
  enhancements: HybridEnhancements = getDefaultHybridEnhancements(settings)
): any {
  const options = {
    ...mode.options,
    outputDir,
    quiet: false
  };

  if (mode.requiresHybrid) {
    options.hybridUrl = settings.hybridUrl;
    options.hybridTimeout = settings.hybridTimeout;
    options.hybridFallback = settings.hybridFallback;
    if (enhancements.formula || enhancements.picture) {
      options.hybridMode = "full";
    }
  }

  return options;
}

async function assertHybridBackendAvailable(settings: PdfToMdSettings) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 2500);

  try {
    await fetch(settings.hybridUrl, {
      method: "GET",
      signal: controller.signal
    });
  } catch (e) {
    throw new Error(`Hybrid backend is not reachable at ${settings.hybridUrl}`);
  } finally {
    window.clearTimeout(timeout);
  }
}

// ─── PDF conversion functions ────────────────────────────────────────────────

const JAR_NAME = "opendataloader-pdf-cli.jar";

function getVaultPath(app: App): string {
  const adapter = app.vault.adapter as any;
  if (adapter.basePath && typeof adapter.basePath === "string") return adapter.basePath;
  if (adapter.getBasePath && typeof adapter.getBasePath === "function") return adapter.getBasePath();
  return process.cwd();
}

function getPluginDir(app: App, manifest: any): string {
  const vaultPath = getVaultPath(app);
  if (manifest?.dir && typeof manifest.dir === "string") {
    return path.isAbsolute(manifest.dir) ? manifest.dir : path.join(vaultPath, manifest.dir);
  }

  const configDir = (app.vault as any).configDir || ".obsidian";
  return path.join(vaultPath, configDir, "plugins", manifest.id);
}

function getJarPath(pluginDir: string): string {
  const candidates = [
    path.join(pluginDir, "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(pluginDir, "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME),
    path.join(__dirname, "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(__dirname, "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME),
    path.join(process.cwd(), "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(process.cwd(), "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME)
  ];

  const jarPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!jarPath) {
    throw new Error(
      `JAR file not found. Please run "npm install @opendataloader/pdf" in the plugin folder.\n\n` +
      `Checked:\n${candidates.join("\n")}`
    );
  }

  return jarPath;
}

function executeJar(pluginDir: string, args: string[], executionOptions: { streamOutput?: boolean } = {}) {
  const { streamOutput = false } = executionOptions;
  return new Promise((resolve, reject) => {
    const jarPath = getJarPath(pluginDir);
    const command = "java";
    const commandArgs = ["-jar", jarPath, ...args];

    const javaProcess = spawn(command, commandArgs);
    let stdout = "";
    let stderr = "";

    javaProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (streamOutput) process.stdout.write(chunk);
      stdout += chunk;
    });

    javaProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (streamOutput) process.stderr.write(chunk);
      stderr += chunk;
    });

    javaProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const errorOutput = stderr || stdout;
        const error = new Error(`The opendataloader-pdf CLI exited with code ${code}.\n\n${errorOutput}`);
        reject(error);
      }
    });

    javaProcess.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        reject(new Error("'java' command not found. Please ensure Java is installed and in your system's PATH."));
      } else {
        reject(err);
      }
    });
  });
}

function buildArgs(options: any): string[] {
  const args = [];
  if (options.outputDir) args.push("--output-dir", options.outputDir);
  if (options.password) args.push("--password", options.password);
  if (options.format) {
    if (Array.isArray(options.format)) {
      if (options.format.length > 0) args.push("--format", options.format.join(","));
    } else {
      args.push("--format", options.format);
    }
  }
  if (options.quiet) args.push("--quiet");
  if (options.contentSafetyOff) {
    if (Array.isArray(options.contentSafetyOff)) {
      if (options.contentSafetyOff.length > 0) args.push("--content-safety-off", options.contentSafetyOff.join(","));
    } else {
      args.push("--content-safety-off", options.contentSafetyOff);
    }
  }
  if (options.sanitize) args.push("--sanitize");
  if (options.keepLineBreaks) args.push("--keep-line-breaks");
  if (options.replaceInvalidChars) args.push("--replace-invalid-chars", options.replaceInvalidChars);
  if (options.useStructTree) args.push("--use-struct-tree");
  if (options.tableMethod) args.push("--table-method", options.tableMethod);
  if (options.readingOrder) args.push("--reading-order", options.readingOrder);
  if (options.markdownPageSeparator) args.push("--markdown-page-separator", options.markdownPageSeparator);
  if (options.textPageSeparator) args.push("--text-page-separator", options.textPageSeparator);
  if (options.htmlPageSeparator) args.push("--html-page-separator", options.htmlPageSeparator);
  if (options.imageOutput) args.push("--image-output", options.imageOutput);
  if (options.imageFormat) args.push("--image-format", options.imageFormat);
  if (options.imageDir) args.push("--image-dir", options.imageDir);
  if (options.pages) args.push("--pages", options.pages);
  if (options.includeHeaderFooter) args.push("--include-header-footer");
  if (options.detectStrikethrough) args.push("--detect-strikethrough");
  if (options.hybrid && options.hybrid !== "off") args.push("--hybrid", options.hybrid);
  if (options.hybridMode) args.push("--hybrid-mode", options.hybridMode);
  if (options.hybridUrl) args.push("--hybrid-url", options.hybridUrl);
  if (options.hybridTimeout) args.push("--hybrid-timeout", String(options.hybridTimeout));
  if (options.hybridFallback) args.push("--hybrid-fallback");
  if (options.toStdout) args.push("--to-stdout");
  return args;
}

async function convert(pluginDir: string, inputPaths: string | string[], options: any = {}) {
  const inputList = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  if (inputList.length === 0) {
    return Promise.reject(new Error("At least one input path must be provided."));
  }
  for (const input of inputList) {
    if (!fs.existsSync(input)) {
      return Promise.reject(new Error(`Input file or folder not found: ${input}`));
    }
  }
  const args = [...inputList, ...buildArgs(options)];
  return executeJar(pluginDir, args, { streamOutput: !options.quiet });
}

// ─── Settings ────────────────────────────────────────────────────────────────

class PdfToMdSettingTab extends PluginSettingTab {
  plugin: PdfToMdPlugin;

  constructor(app: App, plugin: PdfToMdPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "PDF to MD" });

    new Setting(containerEl)
      .setName("Default conversion mode")
      .setDesc("Mode selected when the conversion dialog opens.")
      .addDropdown((dropdown) => {
        CONVERSION_MODES.forEach((mode) => dropdown.addOption(mode.id, mode.name));
        dropdown
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Hybrid backend URL")
      .setDesc("Used by all hybrid modes. The default OpenDataLoader backend listens on http://localhost:5002.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.hybridUrl)
          .setValue(this.plugin.settings.hybridUrl)
          .onChange(async (value) => {
            this.plugin.settings.hybridUrl = value.trim() || DEFAULT_SETTINGS.hybridUrl;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hybrid timeout")
      .setDesc("Milliseconds before the client gives up. Use 0 for no timeout.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.hybridTimeout)
          .setValue(this.plugin.settings.hybridTimeout)
          .onChange(async (value) => {
            this.plugin.settings.hybridTimeout = value.trim() || DEFAULT_SETTINGS.hybridTimeout;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Fallback to local processing")
      .setDesc("When enabled, hybrid modes can fall back to Java-only conversion if the backend fails.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hybridFallback)
          .onChange(async (value) => {
            this.plugin.settings.hybridFallback = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hybrid OCR by default")
      .setDesc("Adds --force-ocr to the recommended hybrid backend command.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hybridOcr)
          .onChange(async (value) => {
            this.plugin.settings.hybridOcr = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("OCR languages")
      .setDesc('Used when Hybrid OCR is enabled, for example "ch_sim,en" or "en".')
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.hybridOcrLang)
          .setValue(this.plugin.settings.hybridOcrLang)
          .onChange(async (value) => {
            this.plugin.settings.hybridOcrLang = value.trim() || DEFAULT_SETTINGS.hybridOcrLang;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hybrid formula enrichment by default")
      .setDesc("Adds --enrich-formula to the recommended backend command and uses full hybrid mode.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hybridFormula)
          .onChange(async (value) => {
            this.plugin.settings.hybridFormula = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hybrid picture description by default")
      .setDesc("Adds --enrich-picture-description to the recommended backend command and uses full hybrid mode.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.hybridPicture)
          .onChange(async (value) => {
            this.plugin.settings.hybridPicture = value;
            await this.plugin.saveSettings();
          })
      );
  }
}

// ─── Conversion Modal ────────────────────────────────────────────────────────

class ConvertModal extends Modal {
  private file: TFile;
  private pluginDir: string;
  private settings: PdfToMdSettings;
  private nameInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private convertBtn: HTMLButtonElement;
  private modeSelect: HTMLSelectElement;
  private folderInput: HTMLInputElement;
  private enhancementWrap: HTMLElement;
  private ocrInput: HTMLInputElement;
  private formulaInput: HTMLInputElement;
  private pictureInput: HTMLInputElement;

  constructor(app: App, file: TFile, pluginDir: string, settings: PdfToMdSettings) {
    super(app);
    this.file = file;
    this.pluginDir = pluginDir;
    this.settings = settings;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("pcm-root");

    // Header: icon + source filename
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

    // Output filename input
    const fieldWrap = contentEl.createDiv("pcm-field");
    fieldWrap.createEl("label", { cls: "pcm-label", text: "Save as", attr: { for: "pcm-name" } });

    const inputRow = fieldWrap.createDiv("pcm-input-row");
    this.nameInput = inputRow.createEl("input", {
      cls: "pcm-input",
      attr: { id: "pcm-name", type: "text", spellcheck: "false" },
    });
    this.nameInput.value = this.file.basename;
    inputRow.createEl("span", { cls: "pcm-ext", text: ".md" });

    this.nameInput.addEventListener("focus", () => this.nameInput.select());

    // Output folder input
    const folderField = contentEl.createDiv("pcm-field");
    folderField.createEl("label", { cls: "pcm-label", text: "Output folder (optional)", attr: { for: "pcm-folder" } });

    const folderInputRow = folderField.createDiv("pcm-input-row");
    this.folderInput = folderInputRow.createEl("input", {
      cls: "pcm-input",
      attr: { id: "pcm-folder", type: "text", placeholder: "e.g., converted-pdfs" },
    });

    // Conversion mode selection
    const modeField = contentEl.createDiv("pcm-field");
    modeField.createEl("label", { cls: "pcm-label", text: "Conversion Mode", attr: { for: "pcm-mode" } });

    this.modeSelect = modeField.createEl("select", { cls: "pcm-select", attr: { id: "pcm-mode" } });

    CONVERSION_MODES.forEach(mode => {
      const option = this.modeSelect.createEl("option", {
        value: mode.id,
        text: mode.name
      });
      if (mode.id === this.settings.defaultMode) {
        option.selected = true;
      }
    });

    // Mode description
    const modeDesc = modeField.createEl("div", { cls: "pcm-mode-desc" });
    this.updateModeDescription();

    this.modeSelect.addEventListener("change", () => {
      this.updateEnhancementVisibility();
      this.updateModeDescription();
    });

    // Hybrid enhancements
    this.enhancementWrap = contentEl.createDiv("pcm-field pcm-enhancements");
    this.enhancementWrap.createEl("label", { cls: "pcm-label", text: "Hybrid enhancements" });
    const enhancementGrid = this.enhancementWrap.createDiv("pcm-check-grid");
    this.ocrInput = this.createCheckbox(enhancementGrid, "OCR", this.settings.hybridOcr);
    this.formulaInput = this.createCheckbox(enhancementGrid, "Formulas", this.settings.hybridFormula);
    this.pictureInput = this.createCheckbox(enhancementGrid, "Pictures", this.settings.hybridPicture);
    [this.ocrInput, this.formulaInput, this.pictureInput].forEach((input) => {
      input.addEventListener("change", () => this.updateModeDescription());
    });
    this.updateEnhancementVisibility();
    this.updateModeDescription();

    // Status bar
    this.statusEl = contentEl.createDiv("pcm-status pcm-status-idle");
    this.statusEl.textContent = "Ready";

    // Action buttons
    const actions = contentEl.createDiv("pcm-actions");
    this.convertBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-primary", text: "Convert" });
    this.convertBtn.onclick = () => this.runConvert();

    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });

    this.folderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });

    const cancelBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-secondary", text: "Cancel" });
    cancelBtn.onclick = () => this.close();

    setTimeout(() => this.nameInput.focus(), 50);
  }

  private updateModeDescription() {
    const selectedMode = CONVERSION_MODES.find(mode => mode.id === this.modeSelect.value);
    if (selectedMode) {
      // Remove existing description
      const existingDesc = this.modeSelect.nextElementSibling;
      if (existingDesc && existingDesc.classList.contains("pcm-mode-desc")) {
        existingDesc.remove();
      }

      // Add new description
      const descEl = this.modeSelect.parentElement.createEl("div", {
        cls: "pcm-mode-desc",
        text: describeMode(selectedMode, this.settings)
      });
      if (selectedMode.requiresHybrid) {
        descEl.textContent = `${selectedMode.description} Start backend: ${getHybridServerCommand(selectedMode, this.settings, this.getHybridEnhancements())}`;
      }
    }
  }

  private createCheckbox(parent: HTMLElement, label: string, checked: boolean): HTMLInputElement {
    const item = parent.createEl("label", { cls: "pcm-check" });
    const input = item.createEl("input", { attr: { type: "checkbox" } });
    input.checked = checked;
    item.createEl("span", { text: label });
    return input;
  }

  private updateEnhancementVisibility() {
    if (!this.enhancementWrap) return;
    const mode = getMode(this.modeSelect.value);
    this.enhancementWrap.toggle(mode.requiresHybrid);
  }

  private getHybridEnhancements(): HybridEnhancements {
    return {
      ocr: !!this.ocrInput?.checked,
      formula: !!this.formulaInput?.checked,
      picture: !!this.pictureInput?.checked
    };
  }

  private async runConvert() {
    const rawName = this.nameInput?.value?.trim();
    if (!rawName) {
      this.setStatus("error", "Please enter a filename");
      if (this.nameInput) this.nameInput.focus();
      return;
    }
    if (/[/\\:*?"<>|]/.test(rawName)) {
      this.setStatus("error", 'Name contains invalid characters: / \\ : * ? " < > |');
      if (this.nameInput) this.nameInput.focus();
      return;
    }

    const outputFolder = this.folderInput?.value?.trim();
    if (outputFolder && /[/\\:*?"<>|]/.test(outputFolder)) {
      this.setStatus("error", 'Folder name contains invalid characters: / \\ : * ? " < > |');
      if (this.folderInput) this.folderInput.focus();
      return;
    }

    if (this.convertBtn) this.convertBtn.disabled = true;
    if (this.nameInput) this.nameInput.disabled = true;
    if (this.folderInput) this.folderInput.disabled = true;
    if (this.modeSelect) this.modeSelect.disabled = true;

    this.setStatus("converting", "Checking system requirements...");

    try {
      // Check Java installation
      this.setStatus("converting", "Checking Java installation...");
      try {
        execSync("java -version", { stdio: "pipe" });
      } catch (e) {
        throw new Error(
          "Java Runtime Environment (JRE) is required but not found.\n\n" +
          "Please install Java from:\n" +
          "• macOS: brew install openjdk\n" +
          "• Or download from: https://www.java.com/download/"
        );
      }

      if (!this.file || !this.file.path) {
        throw new Error("Invalid PDF file: file or file path is undefined");
      }

      new Notice(`📄 Converting ${this.file.name} to Markdown...`);

      const vaultPath = getVaultPath(this.app);

      if (!vaultPath || typeof vaultPath !== 'string') {
        throw new Error(`Invalid vault path: ${vaultPath}`);
      }

      // Determine output directory
      let outputDir = vaultPath;
      if (outputFolder) {
        outputDir = path.join(vaultPath, outputFolder);
        // Create output folder if it doesn't exist
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      }

      if (!this.file.path || typeof this.file.path !== 'string') {
        throw new Error(`Invalid file path: ${this.file.path}`);
      }

      const pdfAbs = path.join(vaultPath, this.file.path);

      if (!fs.existsSync(pdfAbs)) {
        throw new Error(`PDF file not found: ${pdfAbs}`);
      }

      // Get selected conversion mode
      const selectedMode = getMode(this.modeSelect.value);

      // Use selected conversion mode options
      if (selectedMode.requiresHybrid) {
        this.setStatus("converting", `Checking hybrid backend at ${this.settings.hybridUrl}...`);
        await assertHybridBackendAvailable(this.settings);
      }
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);

      const conversionOptions = getConversionOptions(selectedMode, this.settings, outputDir, this.getHybridEnhancements());

      await convert(this.pluginDir, [pdfAbs], conversionOptions);

      // Check for generated files
      const expectedMdPath = path.join(outputDir, this.file.basename + ".md");
      if (!fs.existsSync(expectedMdPath)) {
        throw new Error(
          `Conversion completed but no .md file was created.\n\n` +
          `Expected file: ${expectedMdPath}\n` +
          `Please check if the PDF file is valid and try again.`
        );
      }

      // Rename to user's chosen name
      const targetMd = path.join(outputDir, rawName + ".md");
      if (expectedMdPath !== targetMd) {
        fs.renameSync(expectedMdPath, targetMd);
      }

      // Refresh vault
      try {
        await this.app.vault.adapter.list("/");
      } catch (e) {
        // Continue anyway, the file should still be created
      }

      const outputLocation = outputFolder ? `${outputFolder}/${rawName}.md` : `${rawName}.md`;
      this.setStatus("done", `Saved as ${outputLocation}`);
      new Notice(`✅ Successfully converted to ${outputLocation}`);
      setTimeout(() => this.close(), 1800);

    } catch (e: any) {
      let errorMessage = e.message ?? "Conversion failed";

      if (errorMessage.includes("java")) {
        errorMessage = "Java is required but not installed. Please install Java Runtime Environment.";
      } else if (errorMessage.includes("JAR file not found") || errorMessage.includes("Could not locate")) {
        errorMessage = "PDF conversion library not found. Please reinstall the plugin.";
      } else if (errorMessage.includes("hybrid") || errorMessage.includes("Hybrid backend") || errorMessage.includes("localhost:5002") || errorMessage.includes("Connection")) {
        const selectedMode = getMode(this.modeSelect.value);
        const command = getHybridServerCommand(selectedMode, this.settings, this.getHybridEnhancements()) || "opendataloader-pdf-hybrid --port 5002";
        errorMessage =
          `Hybrid backend is required for this mode.\n\n` +
          `Start it in a terminal first:\n${command}\n\n` +
          `Then retry the conversion.`;
      } else if (errorMessage.includes("path.join") || errorMessage.includes("path.resolve")) {
        errorMessage = "Path error: Invalid file or directory path. Please check your vault configuration.";
      }

      this.setStatus("error", errorMessage);
      new Notice(`❌ Conversion failed: ${errorMessage}`);
      if (this.convertBtn) this.convertBtn.disabled = false;
      if (this.nameInput) this.nameInput.disabled = false;
      if (this.folderInput) this.folderInput.disabled = false;
      if (this.modeSelect) this.modeSelect.disabled = false;
      if (this.convertBtn) this.convertBtn.textContent = "Retry";
    }
  }

  private setStatus(type: "idle" | "converting" | "done" | "error", text: string) {
    if (this.statusEl) {
      this.statusEl.className = `pcm-status pcm-status-${type}`;
      if (type === "converting") {
        this.statusEl.innerHTML = `<span class="pcm-spinner"></span><span>${text}</span>`;
      } else {
        this.statusEl.textContent = text;
      }
    }
  }

  onClose() {
    if (this.contentEl) {
      this.contentEl.empty();
    }
  }
}
