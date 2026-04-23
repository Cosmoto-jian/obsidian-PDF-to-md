import { App, Plugin, Modal, TFile, Notice, Setting } from "obsidian";
import * as path from "path";
import * as fs from "fs";
import { execSync, spawn } from "child_process";

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
              .onClick(() => new ConvertModal(this.app, pdfFile).open())
          );
        }
      })
    );
  }
}

// ─── Conversion Modes ────────────────────────────────────────────────────────

interface ConversionMode {
  id: string;
  name: string;
  description: string;
  options: any;
}

const CONVERSION_MODES: ConversionMode[] = [
  {
    id: "fast",
    name: "Fast Mode",
    description: "Quick conversion with basic formatting",
    options: { format: "markdown" }
  },
  {
    id: "hybrid",
    name: "Hybrid Mode (Recommended)",
    description: "AI-powered conversion with better layout detection",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "auto",
      hybridFallback: true
    }
  },
  {
    id: "hybrid-ocr",
    name: "Hybrid + OCR",
    description: "AI conversion with OCR for scanned documents",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "full",
      hybridFallback: true,
      sanitize: true
    }
  },
  {
    id: "hybrid-formula",
    name: "Hybrid + Formula",
    description: "Enhanced math formula detection and conversion",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "auto",
      hybridFallback: true,
      useStructTree: true
    }
  },
  {
    id: "hybrid-picture",
    name: "Hybrid + Picture",
    description: "Better image extraction and handling",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "auto",
      hybridFallback: true,
      imageOutput: "external",
      imageFormat: "png"
    }
  },
  {
    id: "hybrid-all",
    name: "Hybrid + Complete",
    description: "Maximum quality with all enhancements",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "full",
      hybridFallback: true,
      useStructTree: true,
      imageOutput: "external",
      imageFormat: "png",
      sanitize: true,
      detectStrikethrough: true
    }
  }
];

// ─── Fixed PDF conversion functions ──────────────────────────────────────────

const JAR_NAME = "opendataloader-pdf-cli.jar";

function getJarPath(): string {
  const pluginDir = '/Users/waltry/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/obsidian-PDF-to-md';
  const jarPath = path.join(pluginDir, 'node_modules', '@opendataloader', 'pdf', 'lib', JAR_NAME);

  if (!fs.existsSync(jarPath)) {
    throw new Error(`JAR file not found at ${jarPath}. Please reinstall the plugin.`);
  }

  return jarPath;
}

function executeJar(args: string[], executionOptions = {}) {
  const { streamOutput = false } = executionOptions;
  return new Promise((resolve, reject) => {
    const jarPath = getJarPath();
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
  if (options.hybrid) args.push("--hybrid", options.hybrid);
  if (options.hybridMode) args.push("--hybrid-mode", options.hybridMode);
  if (options.hybridUrl) args.push("--hybrid-url", options.hybridUrl);
  if (options.hybridTimeout) args.push("--hybrid-timeout", options.hybridTimeout);
  if (options.hybridFallback) args.push("--hybrid-fallback");
  if (options.toStdout) args.push("--to-stdout");
  return args;
}

async function convert(inputPaths: string | string[], options: any = {}) {
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
  return executeJar(args, { streamOutput: !options.quiet });
}

// ─── Enhanced Modal with Mode Selection ──────────────────────────────────────

class ConvertModal extends Modal {
  private file: TFile;
  private nameInput: HTMLInputElement;
  private statusEl: HTMLElement;
  private convertBtn: HTMLButtonElement;
  private modeSelect: HTMLSelectElement;
  private folderInput: HTMLInputElement;

  constructor(app: App, file: TFile) {
    super(app);
    this.file = file;
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
      if (mode.id === "hybrid") {
        option.selected = true; // Default to Hybrid mode
      }
    });

    // Mode description
    const modeDesc = modeField.createEl("div", { cls: "pcm-mode-desc" });
    this.updateModeDescription();

    this.modeSelect.addEventListener("change", () => {
      this.updateModeDescription();
    });

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
        text: selectedMode.description
      });
    }
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

      // Get vault path safely
      let vaultPath: string;
      try {
        const adapter = (this.app.vault.adapter as any);
        if (adapter.basePath && typeof adapter.basePath === 'string') {
          vaultPath = adapter.basePath;
        } else if (adapter.getBasePath && typeof adapter.getBasePath === 'function') {
          vaultPath = adapter.getBasePath();
        } else {
          vaultPath = process.cwd();
        }
      } catch (e) {
        vaultPath = process.cwd();
      }

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
      const selectedMode = CONVERSION_MODES.find(mode => mode.id === this.modeSelect.value) || CONVERSION_MODES[1]; // Default to hybrid

      // Use selected conversion mode options
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);

      const conversionOptions = {
        ...selectedMode.options,
        outputDir: outputDir,
        quiet: false
      };

      const result = await convert([pdfAbs], conversionOptions);

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