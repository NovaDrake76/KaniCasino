// Fails when a read of a User document would carry the inventory back into node.
//
//   node scripts/checkUserReads.js
//
// The embedded inventory reaches 21k entries and 1.4 MB, and the link to atlas runs at
// about 96 KB/s, so every one of these is fifteen seconds for the deepest account. It has
// been shipped nine times: the fan sweep, the wallet writes, both halves of the auth
// middleware, the inventory page, collections, login, the market listing and the admin
// user list.
//
// A read that genuinely needs the array says so at the call site:
//
//   // inventory-read: the pre-image is the result
//   const user = await User.findById(userId);
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");

const ROOT = path.resolve(__dirname, "..");
const SKIP = new Set(["node_modules", "__tests__", ".git", "coverage"]);
const MARKER = "inventory-read:";
const FIELD = "inventory";

// the reads that hand a document back. exists/count/updateOne return no fields.
const READS = new Set([
  "find",
  "findById",
  "findOne",
  "findOneAndUpdate",
  "findByIdAndUpdate",
  "findOneAndDelete",
  "findByIdAndDelete",
  "findOneAndReplace",
]);
// where the projection sits for each of them
const PROJECTION_ARG = { find: 1, findById: 1, findOne: 1 };
const OPTIONS_ARG = { findOneAndUpdate: 2, findByIdAndUpdate: 2, findOneAndDelete: 1, findByIdAndDelete: 1, findOneAndReplace: 2 };

function files(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

// a projection is often a const declared nearby, or a string built from one, so the
// value is followed within the file before it is judged
function resolve(node, consts, depth = 0) {
  if (!node || depth > 4) return node;
  if (node.type === "Identifier" && consts.has(node.name)) {
    return resolve(consts.get(node.name), consts, depth + 1);
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = resolve(node.left, consts, depth + 1);
    const right = resolve(node.right, consts, depth + 1);
    const text = (n) => (n && typeof n.value === "string" ? n.value : null);
    if (text(left) !== null && text(right) !== null) {
      return { type: "StringLiteral", value: text(left) + text(right) };
    }
  }
  return node;
}

// "-password -inventory" / "username level" / { password: 0, ...WITHOUT_INVENTORY }
// -> true when the result cannot contain the inventory
function dropsInventory(node, consts) {
  node = resolve(node, consts || new Map());
  if (!node) return false;

  if (node.type === "StringLiteral" || (node.type === "Literal" && typeof node.value === "string")) {
    const fields = String(node.value).split(/\s+/).filter(Boolean);
    if (!fields.length) return false;
    if (fields.includes(`-${FIELD}`)) return true;
    // an inclusion list that never names it cannot bring it back
    return fields.every((f) => !f.startsWith("-")) && !fields.includes(FIELD);
  }

  if (node.type === "ObjectExpression") {
    let excluded = false;
    let inclusionOnly = node.properties.length > 0;
    for (const prop of node.properties) {
      if (prop.type === "SpreadElement") {
        if (dropsInventory(prop.argument, consts)) excluded = true;
        else inclusionOnly = false;
        continue;
      }
      const key = prop.key && (prop.key.name || prop.key.value);
      const value = prop.value && (prop.value.value !== undefined ? prop.value.value : null);
      if (value === 0 || value === false) {
        inclusionOnly = false;
        if (key === FIELD) excluded = true;
      } else if (key === FIELD) {
        return false;
      }
    }
    return excluded || inclusionOnly;
  }

  // the shared constant, imported rather than declared here
  if (node.type === "Identifier" && node.name === "WITHOUT_INVENTORY") return true;
  return false;
}

// walk back up the member chain this call sits in, looking for .select(...)
function chainDropsInventory(call, ancestors, consts) {
  let current = call;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const parent = ancestors[i];
    if (parent.type === "MemberExpression" && parent.object === current) {
      current = parent;
      continue;
    }
    if (parent.type === "CallExpression" && parent.callee === current) {
      const name = current.type === "MemberExpression" && current.property && current.property.name;
      if (name === "select" && dropsInventory(parent.arguments[0], consts)) return true;
      current = parent;
      continue;
    }
    if (parent.type === "AwaitExpression" && parent.argument === current) {
      current = parent;
      continue;
    }
    break;
  }
  return false;
}

// findOneAndUpdate is usually handed an options object built a few lines earlier
function resolveOptionsProjection(options, consts) {
  const resolved = resolve(options, consts);
  if (!resolved || resolved.type !== "ObjectExpression") return null;
  const prop = resolved.properties.find(
    (p) => p.key && (p.key.name || p.key.value) === "projection"
  );
  return prop ? prop.value : null;
}

function exempt(lines, line) {
  return [line - 1, line - 2, line - 3]
    .map((n) => lines[n])
    .some((text) => typeof text === "string" && text.includes(MARKER));
}

// exported so the rule can be tested against snippets rather than only against the repo
function scan(source, file = "<snippet>") {
  if (!source.includes("User.")) return [];
  const lines = source.split("\n");
  const ast = parser.parse(source, { sourceType: "unambiguous", errorRecovery: true });

  const found = [];
  const consts = new Map();
  // the ancestor chain is kept as we descend, because .select() sits above the call
  const path_ = [];
  (function descend(node) {
    if (!node || typeof node.type !== "string") return;
    path_.push(node);
    if (node.type === "VariableDeclarator" && node.id.type === "Identifier" && node.init) {
      consts.set(node.id.name, node.init);
    }
    if (
      node.type === "CallExpression" &&
      node.callee.type === "MemberExpression" &&
      node.callee.object.type === "Identifier" &&
      node.callee.object.name === "User" &&
      node.callee.property &&
      READS.has(node.callee.property.name)
    ) {
      const method = node.callee.property.name;
      const line = node.loc.start.line;
      const projection =
        (PROJECTION_ARG[method] !== undefined && node.arguments[PROJECTION_ARG[method]]) || null;
      const options = (OPTIONS_ARG[method] !== undefined && node.arguments[OPTIONS_ARG[method]]) || null;
      const optionProjection =
        options && options.type === "ObjectExpression"
          ? (options.properties.find((p) => p.key && (p.key.name || p.key.value) === "projection") || {}).value
          : null;

      const safe =
        dropsInventory(projection, consts) ||
        dropsInventory(optionProjection, consts) ||
        dropsInventory(resolveOptionsProjection(options, consts), consts) ||
        chainDropsInventory(node, path_.slice(0, -1), consts) ||
        exempt(lines, line);

      if (!safe) {
        found.push({ file, line, method, code: lines[line - 1].trim().slice(0, 96) });
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key.endsWith("Comments")) continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach(descend);
      else if (value && typeof value.type === "string") descend(value);
    }
    path_.pop();
  })(ast);

  return found;
}

const check = (file) => scan(fs.readFileSync(file, "utf8"), file);

function main() {
  const offenders = files(ROOT).flatMap(check);
  if (!offenders.length) {
    console.log("every User read either projects the inventory away or says why it needs it");
    return;
  }

  console.error(`${offenders.length} User read${offenders.length === 1 ? "" : "s"} would carry the inventory back:\n`);
  for (const row of offenders) {
    console.error(`  ${path.relative(ROOT, row.file).replace(/\\/g, "/")}:${row.line}`);
    console.error(`    ${row.code}`);
  }
  console.error(`
Project the fields you need, or mark the call if the array really is the answer:

  // ${MARKER} why this one needs every entry
`);
  process.exit(1);
}

if (require.main === module) main();

module.exports = { scan, MARKER };
