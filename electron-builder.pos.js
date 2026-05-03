const baseConfig = require("./electron-builder.base.json");
const { createGithubPublishConfig } = require("./electron/publish-config");

module.exports = {
  ...baseConfig,
  appId: "com.eastmatt.pos",
  productName: "ParhelionPOS",
  extraMetadata: {
    main: "electron/main-pos.js",
  },
  win: {
    ...(baseConfig.win || {}),
    icon: "icon.ico",
    artifactName: "pos-${version}.${ext}",
  },
  nsis: {
    installerIcon: "icon.ico",
    uninstallerIcon: "icon.ico",
    installerHeaderIcon: "icon.ico",
    oneClick: false,
    perMachine: false,
  },
  publish: createGithubPublishConfig("pos"),
};
