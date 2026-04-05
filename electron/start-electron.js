const { spawn } = require("child_process");
const path = require("path");

const electronBinary = require("electron");
const variant = process.argv[2] === "erp" ? "erp" : "pos";
const entryFile = path.join(__dirname, variant === "erp" ? "main-erp.js" : "main-pos.js");

const childEnv = { ...process.env };
delete childEnv.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBinary, [entryFile], {
  stdio: "inherit",
  windowsHide: false,
  env: childEnv,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
