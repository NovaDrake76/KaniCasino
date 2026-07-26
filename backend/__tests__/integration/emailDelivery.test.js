process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.API_URL = "https://api.example.com";
process.env.SITE_URL = "https://site.example.com";

const mockSent = [];
jest.mock("@aws-sdk/client-sesv2", () => ({
  SESv2Client: class {
    async send(cmd) {
      mockSent.push(cmd.input);
      return {};
    }
  },
  SendEmailCommand: class {
    constructor(input) {
      this.input = input;
    }
  },
}));

const fs = require("fs");
const path = require("path");
const request = require("supertest");
const { setupDb, clearDb, teardownDb } = require("./db");
const { makeApp, uniqueSuffix } = require("./helpers");

const User = require("../../models/User");
const { sendMail } = require("../../utils/mailer");

let app;

beforeAll(async () => {
  await setupDb();
  app = makeApp();
});
beforeEach(() => {
  mockSent.length = 0;
  process.env.MAIL_ENABLED = "true";
});
afterEach(async () => {
  delete process.env.MAIL_ENABLED;
  await clearDb();
});
afterAll(teardownDb);

const makeUser = () => {
  const s = uniqueSuffix();
  return User.create({ username: `user-${s}`, email: `user-${s}@example.com`, password: "x" });
};

const headerValue = (name) => mockSent[0].Content.Simple.Headers.find((h) => h.Name === name)?.Value;

describe("one-click unsubscribe", () => {
  it("points the header at the api, not at the page, since the provider POSTs it itself", async () => {
    const u = await makeUser();
    await sendMail({ to: u.email, subject: "s", html: "h", text: "t" });

    const url = headerValue("List-Unsubscribe").replace(/^<|>$/g, "");

    expect(url.startsWith("https://api.example.com/email/unsubscribe")).toBe(true);
    expect(url.startsWith("https://site.example.com")).toBe(false);
    expect(headerValue("List-Unsubscribe-Post")).toBe("List-Unsubscribe=One-Click");
  });

  it("actually opts the user out when that exact url is POSTed back", async () => {
    const u = await makeUser();
    await User.updateOne({ _id: u._id }, { $set: { marketingOptIn: true } });
    await sendMail({ to: u.email, subject: "s", html: "h", text: "t" });

    const url = new URL(headerValue("List-Unsubscribe").replace(/^<|>$/g, ""));
    const res = await request(app).post(url.pathname + url.search);

    expect(res.status).toBe(200);
    expect((await User.findById(u._id)).marketingOptIn).toBe(false);
  });

  it("still sends a human to the page, which is nicer than a json body", async () => {
    const u = await makeUser();
    await sendMail({ to: u.email, subject: "s", html: "h", text: "t" });

    expect(mockSent[0].Content.Simple.Body.Html.Data).toContain("https://site.example.com/unsubscribe");
  });
});

// the two machine-facing endpoints get no api key: SNS does not send one, and neither
// does a mail provider POSTing the unsubscribe header.
describe("route order in index.js", () => {
  const source = fs.readFileSync(path.join(__dirname, "../../index.js"), "utf8");

  it("mounts /email above the api-key gate", () => {
    const mount = source.indexOf('app.use("/email"');
    const gate = source.indexOf("app.use(checkApiKey)");
    expect(mount).toBeGreaterThan(-1);
    expect(gate).toBeGreaterThan(-1);
    expect(mount).toBeLessThan(gate);
  });

  it("still mounts the money routes below it", () => {
    const gate = source.indexOf("app.use(checkApiKey)");
    for (const route of ['app.use("/games"', 'app.use("/marketplace"', 'app.use("/users"']) {
      expect(source.indexOf(route)).toBeGreaterThan(gate);
    }
  });
});
