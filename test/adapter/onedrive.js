const fetch = require("make-fetch-happen");
const clipboardy = require("clipboardy");

const {question} = require("../util");
const {onedrive} = require("../..").drive;

async function getOneDriveAccessToken()  {
  if (process.env.AZURE_ACCESS_TOKEN && Date.now() < Number(process.env.AZURE_ACCESS_TOKEN_EXPIRE)) {
    return process.env.AZURE_ACCESS_TOKEN;
  }
  console.log("Open the URL to login:");
  console.log(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${process.env.AZURE_APP_ID}&scope=Files.ReadWrite.AppFolder&response_type=code&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient`);
  const url = await question("\nInput redirected URL:\n");
  const code = new URL(url).searchParams.get("code");
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `client_id=${process.env.AZURE_APP_ID}&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient&code=${code}&grant_type=authorization_code&scope=Files.ReadWrite.AppFolder`
  });
  const result = await res.json();
  await clipboardy.write(`AZURE_ACCESS_TOKEN=${result.access_token}\nAZURE_ACCESS_TOKEN_EXPIRE=${Date.now() + result.expires_in * 1000}`);
  console.log("\nENV are copied to clipboard");
  return result.access_token;
}

module.exports = {
  name: "onedrive",
  valid: () => process.env.AZURE_APP_ID,
  async before() {
    this.token = await getOneDriveAccessToken();
  },
  get() {
    const drive = onedrive({
      fetch,
      getAccessToken: () => this.token
    });
    if (!this.drive) {
      this.drive = drive;
    }
    return drive;
  },
  async after() {
    await this.drive.delete("docs");
    await this.drive.delete("changes");
    await this.drive.delete("meta.json");
  }
};
