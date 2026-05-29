jest.mock("child_process", () => ({ exec: jest.fn() }));

const crypto = require("crypto");
const { exec } = require("child_process");

const SECRET = "test-deploy-secret";
process.env.DEPLOY_WEBHOOK_SECRET = SECRET;
const { githubDeployHandler } = require("../../deployWebhook");

const sign = (body) => "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");

const mockRes = () => ({
  statusCode: 0,
  body: undefined,
  status(c) { this.statusCode = c; return this; },
  send(b) { this.body = b; return this; },
});

beforeEach(() => jest.clearAllMocks());

describe("github deploy webhook", () => {
  test("rejects a missing signature", () => {
    const body = Buffer.from(JSON.stringify({ ref: "refs/heads/main" }));
    const res = mockRes();
    githubDeployHandler({ headers: { "x-github-event": "push" }, body }, res);
    expect(res.statusCode).toBe(401);
    expect(exec).not.toHaveBeenCalled();
  });

  test("rejects a wrong signature", () => {
    const body = Buffer.from(JSON.stringify({ ref: "refs/heads/main" }));
    const res = mockRes();
    githubDeployHandler({ headers: { "x-hub-signature-256": "sha256=deadbeef", "x-github-event": "push" }, body }, res);
    expect(res.statusCode).toBe(401);
    expect(exec).not.toHaveBeenCalled();
  });

  test("answers a ping", () => {
    const body = Buffer.from(JSON.stringify({ zen: "hello" }));
    const res = mockRes();
    githubDeployHandler({ headers: { "x-hub-signature-256": sign(body), "x-github-event": "ping" }, body }, res);
    expect(res.statusCode).toBe(200);
    expect(exec).not.toHaveBeenCalled();
  });

  test("ignores pushes to other branches", () => {
    const body = Buffer.from(JSON.stringify({ ref: "refs/heads/dev" }));
    const res = mockRes();
    githubDeployHandler({ headers: { "x-hub-signature-256": sign(body), "x-github-event": "push" }, body }, res);
    expect(res.statusCode).toBe(202);
    expect(res.body).toBe("ignored");
    expect(exec).not.toHaveBeenCalled();
  });

  test("deploys on a valid push to main", () => {
    const body = Buffer.from(JSON.stringify({ ref: "refs/heads/main" }));
    const res = mockRes();
    githubDeployHandler({ headers: { "x-hub-signature-256": sign(body), "x-github-event": "push" }, body }, res);
    expect(res.statusCode).toBe(202);
    expect(exec).toHaveBeenCalledTimes(1);
  });
});
