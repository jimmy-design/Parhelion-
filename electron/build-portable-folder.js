const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const unpackedDir = path.join(distDir, "win-unpacked");
const portableRoot = path.join(distDir, "Parhelion-Portable-Apps");
const posOutputDir = path.join(portableRoot, "POS");
const erpOutputDir = path.join(portableRoot, "ERP");

function runNpmScript(scriptName) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  execFileSync(npmCommand, ["run", scriptName], {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function resetDir(targetDir) {
  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });
}

function copyUnpackedApp(targetDir) {
  if (!fs.existsSync(unpackedDir)) {
    throw new Error(`Expected unpacked app folder was not found: ${unpackedDir}`);
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.cpSync(unpackedDir, targetDir, { recursive: true });
}

function writeTextFile(filePath, contents) {
  fs.writeFileSync(filePath, contents, "utf8");
}

function createLauncherScript(filePath, relativeExePath) {
  writeTextFile(
    filePath,
    `@echo off\r\nstart "" "%~dp0${relativeExePath}"\r\n`
  );
}

function createReadme() {
  const readmePath = path.join(portableRoot, "README.txt");
  writeTextFile(
    readmePath,
    [
      "Parhelion Portable Apps",
      "=======================",
      "",
      "This folder contains portable desktop builds for both apps.",
      "",
      "Folders:",
      "- POS\\ParhelionPOS.exe",
      "- ERP\\ParhelionERP.exe",
      "",
      "How to use:",
      "1. Copy the whole 'Parhelion-Portable-Apps' folder to the destination PC.",
      "2. You can place it in Program Files, Program Files (x86), or any writable folder.",
      "3. Open the POS or ERP subfolder and run the .exe directly, or use the launcher .cmd files in this root folder.",
      "4. If you want Desktop shortcuts, create shortcuts to 'Launch POS.cmd' and 'Launch ERP.cmd' after copying the folder.",
      "",
      "Important:",
      "- Keep the full folder structure together.",
      "- Do not move only the .exe files by themselves.",
      "- Each app has its own subfolder because it also needs DLLs and app resources.",
      "- These desktop apps do not bundle the backend server.",
      "- Set EASTMATT_API_BASE_URL to the central server endpoint before launching the apps.",
      "",
    ].join("\r\n")
  );
}

function main() {
  resetDir(portableRoot);

  runNpmScript("build:renderer");

  runNpmScript("package:pos");
  copyUnpackedApp(posOutputDir);

  runNpmScript("package:erp");
  copyUnpackedApp(erpOutputDir);

  createLauncherScript(path.join(portableRoot, "Launch POS.cmd"), "POS\\ParhelionPOS.exe");
  createLauncherScript(path.join(portableRoot, "Launch ERP.cmd"), "ERP\\ParhelionERP.exe");
  createReadme();

  console.log(`Portable apps created at ${portableRoot}`);
}

main();
