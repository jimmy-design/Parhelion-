const GITHUB_OWNER = process.env.EASTMATT_GITHUB_OWNER || "jimmy-design";
const GITHUB_REPO = process.env.EASTMATT_GITHUB_REPO || "Parhelion-";

function createGithubPublishConfig(channel) {
  return [
    {
      provider: "github",
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      releaseType: "release",
      channel,
    },
  ];
}

module.exports = {
  GITHUB_OWNER,
  GITHUB_REPO,
  createGithubPublishConfig,
};
