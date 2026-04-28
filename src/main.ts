import { App, Plugin, Modal, TFile, Notice, PluginSettingTab, Setting, SuggestModal, TFolder } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";
import * as http from "http";
import * as https from "https";

// ─── Custom Errors ────────────────────────────────────────────────────────────

class JavaNotFoundError extends Error {
  constructor() {
    super(
      "Java Runtime Environment (JRE) is required but not found.\n\n" +
      "Please install Java from:\n" +
      "• macOS: brew install openjdk\n" +
      "• Or download from: https://www.java.com/download/"
    );
    this.name = "JavaNotFoundError";
  }
}

class JarNotFoundError extends Error {
  constructor(candidates: string[]) {
    super(
      `JAR file not found. Please run "npm install @opendataloader/pdf" in the plugin folder.\n\n` +
      `Checked:\n${candidates.join("\n")}`
    );
    this.name = "JarNotFoundError";
  }
}

class HybridBackendError extends Error {
  constructor(url: string, detail?: string) {
    super(`Hybrid backend is not reachable at ${url}${detail ? `: ${detail}` : ""}`);
    this.name = "HybridBackendError";
  }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class PdfToMdPlugin extends Plugin {
  private pluginDir = "";
  private hybridBackendProcess: ChildProcess | null = null;
  settings: PdfToMdSettings;

  async onload() {
    await this.loadSettings();
    this.pluginDir = getPluginDir(this.app, this.manifest);
    this.addSettingTab(new PdfToMdSettingTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof TFile) || file.extension.toLowerCase() !== "pdf") return;
        menu.addItem((item) =>
          item
            .setTitle("Convert to Markdown")
            .setIcon("file-text")
            .onClick(() => this.openConvertModal(file))
        );
      })
    );

    this.addCommand({
      id: "convert-active-pdf",
      name: "Convert active PDF to Markdown",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file?.extension.toLowerCase() === "pdf") {
          if (!checking) this.openConvertModal(file);
          return true;
        }
        return false;
      },
    });

    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const pdfFiles = files.filter(f => f instanceof TFile && f.extension.toLowerCase() === "pdf");
        if (pdfFiles.length === 0) return;
        if (pdfFiles.length > 1) {
          menu.addItem((item) =>
            item.setTitle("Convert to Markdown (select one)")
              .setIcon("file-text")
              .setDisabled(true)
          );
          return;
        }
        const pdfFile = pdfFiles[0] as TFile;
        menu.addItem((item) =>
          item
            .setTitle("Convert to Markdown")
            .setIcon("file-text")
            .onClick(() => this.openConvertModal(pdfFile))
        );
      })
    );
  }

  async loadSettings() {
    this.settings = normalizeSettings(Object.assign({}, DEFAULT_SETTINGS, await this.loadData()));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  getPluginDir(): string {
    return this.pluginDir;
  }

  openConvertModal(file: TFile) {
    new ConvertModal(this.app, this, file).open();
  }

  async ensureHybridBackend() {
    if (await isHybridBackendAvailable(this.settings)) return;

    if (this.hybridBackendProcess && !this.hybridBackendProcess.killed) {
      await waitForHybridBackend(this.settings, HYBRID_STARTUP_TIMEOUT_MS, this.hybridBackendProcess);
      return;
    }

    if (!fs.existsSync(HYBRID_BACKEND_BIN) || !fs.existsSync(HYBRID_PYTHON_BIN)) {
      throw new HybridBackendError(
        this.settings.hybridUrl,
        `Missing conda executable. Checked: ${HYBRID_BACKEND_BIN}, ${HYBRID_PYTHON_BIN}`
      );
    }

    const logPath = path.join(this.pluginDir, HYBRID_LOG_NAME);
    fs.writeFileSync(logPath, `Starting hybrid backend at ${new Date().toISOString()}\n`);

    const proc = spawn(HYBRID_PYTHON_BIN, [HYBRID_BACKEND_BIN, ...getHybridServerArgs(this.settings)], {
      cwd: this.pluginDir,
      stdio: "pipe",
      detached: false,
      env: getHybridEnv(),
    });
    this.hybridBackendProcess = proc;

    proc.stdout?.on("data", (data) => fs.appendFileSync(logPath, data.toString()));
    proc.stderr?.on("data", (data) => fs.appendFileSync(logPath, data.toString()));
    proc.once("close", () => {
      if (this.hybridBackendProcess === proc) this.hybridBackendProcess = null;
    });

    await waitForHybridBackend(this.settings, HYBRID_STARTUP_TIMEOUT_MS, proc, logPath);
  }

  onunload() {
    if (this.hybridBackendProcess) {
      this.hybridBackendProcess.kill();
      this.hybridBackendProcess = null;
    }
  }
}

// ─── Conversion Modes ────────────────────────────────────────────────────────

interface PdfToMdSettings {
  defaultMode: string;
  hybridUrl: string;
  hybridTimeout: string;
  hybridFallback: boolean;
  lastOutputFolder: string;
  lastImageFolder: string;
}

const DEFAULT_SETTINGS: PdfToMdSettings = {
  defaultMode: "fast",
  hybridUrl: "http://127.0.0.1:5012",
  hybridTimeout: "0",
  hybridFallback: false,
  lastOutputFolder: "",
  lastImageFolder: "",
};

const HYBRID_BACKEND_BIN = "/opt/anaconda3/bin/opendataloader-pdf-hybrid";
const HYBRID_PYTHON_BIN = "/opt/anaconda3/bin/python3.12";
const HYBRID_OCR_LANG = "ch_sim,en";
const HYBRID_STARTUP_TIMEOUT_MS = 180000;
const HEALTH_CHECK_TIMEOUT_MS = 2500;
const HYBRID_LOG_NAME = "hybrid-backend.log";

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
      hybrid: "off",
      imageOutput: "off",
      keepLineBreaks: true,
      tableMethod: "cluster",
      useStructTree: true
    }
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Uses the hybrid backend for OCR, formulas, and complex layouts.",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "full",
      imageOutput: "external",
      tableMethod: "cluster",
      useStructTree: true
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
  settings.hybridUrl = normalizeHybridUrl(settings.hybridUrl);
  if (!settings.hybridTimeout) settings.hybridTimeout = DEFAULT_SETTINGS.hybridTimeout;
  return settings;
}

function normalizeHybridUrl(value: string): string {
  try {
    const url = new URL(value || DEFAULT_SETTINGS.hybridUrl);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    if (url.hostname === "127.0.0.1" && url.port === "5002") url.port = "5012";
    return url.toString().replace(/\/$/, "");
  } catch (e) {
    return DEFAULT_SETTINGS.hybridUrl;
  }
}

function getHybridPort(settings: PdfToMdSettings): string {
  try {
    return new URL(settings.hybridUrl).port || "5012";
  } catch (e) {
    return "5012";
  }
}

function getHybridHost(settings: PdfToMdSettings): string {
  try {
    const host = new URL(settings.hybridUrl).hostname;
    return host === "localhost" ? "127.0.0.1" : host;
  } catch (e) {
    return "127.0.0.1";
  }
}

function getHybridServerCommand(mode: ConversionMode, settings: PdfToMdSettings): string | null {
  if (!mode.requiresHybrid) return null;
  return `${HYBRID_BACKEND_BIN} ${getHybridServerArgs(settings).join(" ")}`;
}

function getHybridServerArgs(settings: PdfToMdSettings): string[] {
  return [
    "--host", getHybridHost(settings),
    "--port", getHybridPort(settings),
    "--force-ocr",
    "--ocr-lang", HYBRID_OCR_LANG,
    "--enrich-formula",
    "--no-enrich-picture-description",
    "--device", "auto",
  ];
}

function getHybridEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CONDA_PREFIX: "/opt/anaconda3",
    CONDA_DEFAULT_ENV: "base",
    CONDA_SHLVL: process.env.CONDA_SHLVL || "1",
    PYTHONNOUSERSITE: "1",
    HOME: process.env.HOME || "/Users/waltry",
    LANG: process.env.LANG || "en_US.UTF-8",
    LC_ALL: process.env.LC_ALL || process.env.LANG || "en_US.UTF-8",
    PATH: [
      "/opt/anaconda3/bin",
      "/opt/anaconda3/condabin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      process.env.PATH || "",
    ].filter(Boolean).join(":"),
  };
}

function getConversionOptions(mode: ConversionMode, settings: PdfToMdSettings, outputDir: string): any {
  const opts: any = { ...mode.options, outputDir, quiet: false };
  if (mode.requiresHybrid) {
    opts.hybridUrl = settings.hybridUrl;
    opts.hybridTimeout = settings.hybridTimeout;
    opts.hybridFallback = settings.hybridFallback;
  }
  return opts;
}

function checkJavaAvailable(): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("java", ["-version"], { stdio: "pipe" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new JavaNotFoundError());
    });
    proc.on("error", () => reject(new JavaNotFoundError()));
  });
}

async function isHybridBackendAvailable(settings: PdfToMdSettings): Promise<boolean> {
  return requestOk(`${settings.hybridUrl.replace(/\/+$/, "")}/health`, HEALTH_CHECK_TIMEOUT_MS);
}

async function waitForHybridBackend(settings: PdfToMdSettings, timeoutMs: number, proc?: ChildProcess, logPath?: string): Promise<void> {
  const startedAt = Date.now();
  let output = "";
  let processError: Error | null = null;

  proc?.stdout?.on("data", (data) => { output = (output + data.toString()).slice(-4000); });
  proc?.stderr?.on("data", (data) => { output = (output + data.toString()).slice(-4000); });
  proc?.once("error", (err) => { processError = err; });

  while (Date.now() - startedAt < timeoutMs) {
    if (processError) {
      throw new HybridBackendError(settings.hybridUrl, `Process error: ${processError.message}${logPath ? `\nLog: ${logPath}` : ""}`);
    }
    if (proc?.exitCode !== null) {
      throw new HybridBackendError(
        settings.hybridUrl,
        `Process exited with code ${proc.exitCode}${output ? `\n${output}` : ""}${logPath ? `\nLog: ${logPath}` : ""}`
      );
    }
    if (await isHybridBackendAvailable(settings)) return;
    await delay(1000);
  }

  proc?.kill();
  throw new HybridBackendError(
    settings.hybridUrl,
    `Startup timed out after ${Math.round(timeoutMs / 1000)}s${output ? `\n${output}` : ""}${logPath ? `\nLog: ${logPath}` : ""}`
  );
}

function requestOk(rawUrl: string, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      resolve(false);
      return;
    }

    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 400);
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    throw new JarNotFoundError(candidates);
  }

  return jarPath;
}

function executeJar(pluginDir: string, args: string[]): { promise: Promise<string>; process: ChildProcess } {
  const jarPath = getJarPath(pluginDir);
  const javaProcess = spawn("java", ["-jar", jarPath, ...args]);
  let stdout = "";
  let stderr = "";

  javaProcess.stdout.on("data", (data) => { stdout += data.toString(); });
  javaProcess.stderr.on("data", (data) => { stderr += data.toString(); });

  const promise = new Promise<string>((resolve, reject) => {
    javaProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`The opendataloader-pdf CLI exited with code ${code}.\n\n${stderr || stdout}`));
      }
    });

    javaProcess.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new JavaNotFoundError());
      } else {
        reject(err);
      }
    });
  });

  return { promise, process: javaProcess };
}

function buildArgs(options: any): string[] {
  const args: string[] = [];
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
  if (options.hybridTimeout != null && options.hybridTimeout !== "") args.push("--hybrid-timeout", String(options.hybridTimeout));
  if (options.hybridFallback) args.push("--hybrid-fallback");
  if (options.toStdout) args.push("--to-stdout");
  return args;
}

function convert(pluginDir: string, inputPaths: string | string[], options: any = {}): { promise: Promise<string>; process: ChildProcess } {
  const inputList = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  if (inputList.length === 0) throw new Error("At least one input path must be provided.");
  for (const input of inputList) {
    if (!fs.existsSync(input)) throw new Error(`Input file or folder not found: ${input}`);
  }
  return executeJar(pluginDir, [...inputList, ...buildArgs(options)]);
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
      .setDesc("Used by Hybrid mode. The plugin starts the conda backend on http://127.0.0.1:5012 by default.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.hybridUrl)
          .setValue(this.plugin.settings.hybridUrl)
          .onChange(async (value) => {
            this.plugin.settings.hybridUrl = normalizeHybridUrl(value.trim());
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
  }
}

// ─── Conversion Modal ────────────────────────────────────────────────────────

class ConvertModal extends Modal {
  private plugin: PdfToMdPlugin;
  private file: TFile;
  private nameInput: HTMLInputElement;
  private folderInput: HTMLInputElement;
  private imageInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private convertBtn: HTMLButtonElement;
  private modeDescEl: HTMLElement;
  private selectedModeId: string;
  private activeProcess: ChildProcess | null = null;

  constructor(app: App, plugin: PdfToMdPlugin, file: TFile) {
    super(app);
    this.plugin = plugin;
    this.file = file;
    this.selectedModeId = plugin.settings.defaultMode;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("pcm-root");

    // ── Header ──
    const header = contentEl.createDiv("pcm-header");
    header.createEl("div", { cls: "pcm-title", text: "PDF → Markdown" });
    header.createEl("div", { cls: "pcm-file", text: this.file.name });

    // ── Filename ──
    const nameRow = contentEl.createDiv("pcm-row");
    this.nameInput = nameRow.createEl("input", {
      cls: "pcm-input",
      attr: { type: "text", spellcheck: "false" }
    });
    this.nameInput.value = this.file.basename;
    nameRow.createEl("span", { cls: "pcm-ext", text: ".md" });

    // ── Output folder ──
    this.folderInput = this.createFolderRow(contentEl,
      "OUT",
      "Vault root if empty",
      this.plugin.settings.lastOutputFolder
    );

    // ── Image folder ──
    this.imageInput = this.createFolderRow(contentEl,
      "IMG",
      "Vault root if empty",
      this.plugin.settings.lastImageFolder
    );

    // ── Mode pills ──
    const modeBar = contentEl.createDiv("pcm-mode-bar");
    CONVERSION_MODES.forEach(mode => {
      const btn = modeBar.createEl("button", {
        cls: "pcm-mode-btn" + (mode.id === this.selectedModeId ? " active" : ""),
        text: mode.name
      });
      btn.dataset.modeId = mode.id;
      btn.onclick = () => this.selectMode(mode.id);
    });

    // ── Mode description ──
    this.modeDescEl = contentEl.createDiv("pcm-mode-desc");

    // ── Footer ──
    const footer = contentEl.createDiv("pcm-footer");
    this.statusEl = footer.createDiv("pcm-status pcm-status-idle");
    this.statusEl.textContent = "Ready";

    this.convertBtn = footer.createEl("button", { cls: "pcm-convert-btn", text: "Convert" });
    this.convertBtn.onclick = () => this.runConvert();

    // ── Events ──
    this.nameInput.addEventListener("focus", () => this.nameInput.select());
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });
    this.folderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });
    this.imageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.runConvert();
    });

    this.updateModeDescription();
    setTimeout(() => this.nameInput.focus(), 50);
  }

  private createFolderRow(container: HTMLElement, tag: string, placeholder: string, initialValue: string): HTMLInputElement {
    const row = container.createDiv("pcm-row");
    row.createEl("span", { cls: "pcm-row-tag", text: tag });
    const icon = row.createEl("span", { cls: "pcm-folder-icon" });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    const input = row.createEl("input", {
      cls: "pcm-input",
      attr: { type: "text", placeholder, spellcheck: "false" }
    });
    if (initialValue) input.value = initialValue;

    const browse = row.createEl("button", { cls: "pcm-browse-btn" });
    browse.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    browse.onclick = () => {
      new FolderSuggestModal(this.app, (folderPath) => { input.value = folderPath; }).open();
    };
    return input;
  }

  private selectMode(id: string) {
    this.selectedModeId = id;
    const btns = this.contentEl.querySelectorAll(".pcm-mode-btn");
    btns.forEach((btn: HTMLElement) => {
      btn.classList.toggle("active", btn.dataset.modeId === id);
    });
    this.updateModeDescription();
  }

  private updateModeDescription() {
    const mode = CONVERSION_MODES.find(m => m.id === this.selectedModeId);
    this.modeDescEl.textContent = mode ? mode.description : "";
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
    if (outputFolder) {
      if (outputFolder.split('/').some(s => s === '..' || /[\\:*?"<>|]/.test(s))) {
        this.setStatus("error", 'Output folder path is invalid');
        if (this.folderInput) this.folderInput.focus();
        return;
      }
    }

    const imageFolder = this.imageInput?.value?.trim();
    if (imageFolder) {
      if (imageFolder.split('/').some(s => s === '..' || /[\\:*?"<>|]/.test(s))) {
        this.setStatus("error", 'Image folder path is invalid');
        if (this.imageInput) this.imageInput.focus();
        return;
      }
    }

    this.setFormDisabled(true);
    this.setStatus("converting", "Checking Java installation...");

    try {
      await this.rememberFolders(outputFolder, imageFolder);
      await checkJavaAvailable();

      new Notice(`📄 Converting ${this.file.name} to Markdown...`);

      const vaultPath = getVaultPath(this.app);
      if (!vaultPath || typeof vaultPath !== 'string') {
        throw new Error(`Invalid vault path: ${vaultPath}`);
      }

      let outputDir = vaultPath;
      if (outputFolder) {
        outputDir = path.join(vaultPath, outputFolder);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      }

      const pdfAbs = path.join(vaultPath, this.file.path);
      if (!fs.existsSync(pdfAbs)) {
        throw new Error(`PDF file not found: ${pdfAbs}`);
      }

      const selectedMode = getMode(this.selectedModeId);

      if (selectedMode.requiresHybrid) {
        this.setStatus("converting", "Starting hybrid backend with OCR and formula support...");
        await this.plugin.ensureHybridBackend();
      }
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);

      const conversionOptions = getConversionOptions(selectedMode, this.plugin.settings, outputDir);
      if (imageFolder) {
        const baseImageDir = path.isAbsolute(imageFolder)
          ? imageFolder
          : path.join(vaultPath, imageFolder);

        // Create a subfolder named after the PDF file to avoid overwriting images from different documents
        const imageDir = path.join(baseImageDir, this.file.basename);
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }
        conversionOptions.imageDir = imageDir;
      }

      const { promise: conversionPromise, process: javaProcess } = convert(this.plugin.getPluginDir(), [pdfAbs], conversionOptions);
      this.activeProcess = javaProcess;
      try {
        await conversionPromise;
      } finally {
        this.activeProcess = null;
      }

      const expectedMdPath = path.join(outputDir, this.file.basename + ".md");
      if (!fs.existsSync(expectedMdPath)) {
        throw new Error(
          `Conversion completed but no .md file was created.\n\n` +
          `Expected file: ${expectedMdPath}\n` +
          `Please check if the PDF file is valid and try again.`
        );
      }

      const targetMd = path.join(outputDir, rawName + ".md");
      if (expectedMdPath !== targetMd) {
        fs.renameSync(expectedMdPath, targetMd);
      }

      const outputLocation = outputFolder ? `${outputFolder}/${rawName}.md` : `${rawName}.md`;
      this.setStatus("done", `Saved as ${outputLocation}`);
      new Notice(`✅ Successfully converted to ${outputLocation}`);
      setTimeout(() => this.close(), 1800);

    } catch (e: any) {
      let errorMessage: string;

      if (e instanceof JavaNotFoundError) {
        errorMessage = e.message;
      } else if (e instanceof JarNotFoundError) {
        errorMessage = "PDF conversion library not found. Please reinstall the plugin.";
      } else if (e instanceof HybridBackendError) {
        const selectedMode = getMode(this.selectedModeId);
        const command = getHybridServerCommand(selectedMode, this.plugin.settings) || `${HYBRID_BACKEND_BIN} --port 5012`;
        errorMessage =
          `Hybrid backend is required for this mode.\n\n` +
          `Auto-start command:\n${command}\n\n` +
          `${e.message}`;
      } else {
        errorMessage = e.message ?? "Conversion failed";
      }

      this.setStatus("error", errorMessage);
      new Notice(`❌ Conversion failed: ${errorMessage}`);
      this.setFormDisabled(false);
      if (this.convertBtn) this.convertBtn.textContent = "Retry";
    }
  }

  private setFormDisabled(disabled: boolean) {
    if (this.nameInput) this.nameInput.disabled = disabled;
    if (this.folderInput) this.folderInput.disabled = disabled;
    if (this.imageInput) this.imageInput.disabled = disabled;
    if (this.convertBtn) this.convertBtn.disabled = disabled;
    this.contentEl.querySelectorAll(".pcm-mode-btn, .pcm-browse-btn").forEach((btn: HTMLElement) => {
      if (disabled) btn.setAttribute("disabled", "");
      else btn.removeAttribute("disabled");
    });
  }

  private async rememberFolders(outputFolder: string, imageFolder: string) {
    this.plugin.settings.lastOutputFolder = outputFolder || "";
    this.plugin.settings.lastImageFolder = imageFolder || "";
    await this.plugin.saveSettings();
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
    this.activeProcess?.kill("SIGTERM");
    this.contentEl.empty();
  }
}

// ─── Folder Picker ───────────────────────────────────────────────────────────

class FolderSuggestModal extends SuggestModal<string> {
  private onChoose: (path: string) => void;
  private folders: string[];

  constructor(app: App, onChoose: (path: string) => void) {
    super(app);
    this.onChoose = onChoose;
    this.folders = app.vault.getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .map(f => f.path);
    this.setPlaceholder("Search or type a folder path...");
  }

  getSuggestions(query: string): string[] {
    return query
      ? this.folders.filter(f => f.toLowerCase().includes(query.toLowerCase()))
      : this.folders;
  }

  renderSuggestion(folder: string, el: HTMLElement) {
    el.createEl("div", { text: folder || "/" });
  }

  onChooseSuggestion(folder: string) {
    this.onChoose(folder);
  }
}
