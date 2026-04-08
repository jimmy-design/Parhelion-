const baseConfig = require("./electron-builder.base.json");
const { createGithubPublishConfig } = require("./electron/publish-config");

module.exports = {
  ...baseConfig,
  appId: "com.eastmatt.erp",
  productName: "ParhelionERP",
  extraMetadata: {
    main: "electron/main-erp.js",
  },
  win: {
    ...(baseConfig.win || {}),
    artifactName: "erp-${version}.${ext}",
  },
  nsis: {
    installerIcon: "icon.ico",
    uninstallerIcon: "icon.ico",
    installerHeaderIcon: "icon.ico",
    oneClick: false,
    perMachine: false,
  },
  publish: createGithubPublishConfig("erp"),
};
