const fetch = require("make-fetch-happen");
const clipboardy = require("clipboardy");

const {question, FormData, DummyBlob} = require("../util");
const {google} = require("../..").drive;

async function getGoogleAccessToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN && Date.now() < Number(process.env.GOOGLE_ACCESS_TOKEN_EXPIRE)) {
    return process.env.GOOGLE_ACCESS_TOKEN;
  }
  console.log("Open the URL to login:");
  console.log(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_APP_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&response_type=code&scope=https://www.googleapis.com/auth/drive.appdata`);
  const code = await question("\nInput the code:\n");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `client_id=${process.env.GOOGLE_APP_ID}&redirect_uri=urn:ietf:wg:oauth:2.0:oob&code=${code}&grant_type=authorization_code&client_secret=iPscd4omnupJFFIh-caMNV_J`
  });
  const result = await res.json();
  await clipboardy.write(`GOOGLE_ACCESS_TOKEN=${result.access_token}\nGOOGLE_ACCESS_TOKEN_EXPIRE=${Date.now() + result.expires_in * 1000}`);
  console.log("\nENV are copied to clipboard");
  return result.access_token;
}

module.exports = {
  name: "google",
  valid: () => process.env.GOOGLE_APP_ID,
  async before() {
    this.token = await getGoogleAccessToken();
  },
  get() {
    const drive = google({
      fetch,
      FormData,
      Blob: DummyBlob,
      getAccessToken: () => this.token
    });
    if (!this.drive) {
      this.drive = drive;
    }
    return drive;
  },
  async after() {
    for (const meta of this.drive.fileMetaCache.values()) {
      await this.drive.delete(meta.name);
    }
  }
};
