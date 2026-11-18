import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const { resolve } = createRequire(import.meta.url)("./prefill.js");

const BASE_ETH = {
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  chainId: "8453",
};
const ARB_USDC = {
  address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
  chainId: "42161",
};

test("valid camelCase params prefill both sides and the human amount", () => {
  const result = resolve(
    "?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=25"
  );
  assert.deepEqual(result, { from: BASE_ETH, to: ARB_USDC, amount: "25" });
});

test("snake_case params are accepted", () => {
  const result = resolve(
    "from_chain=Ethereum&from_token=USDC&to_chain=Optimism&to_token=ETH"
  );
  assert.deepEqual(result, {
    from: {
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      chainId: "1",
    },
    to: {
      address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      chainId: "10",
    },
  });
});

test("names are case-insensitive and trimmed", () => {
  const result = resolve("?fromChain= polygon &fromToken=usdc&toChain=BASE&toToken=Eth");
  assert.equal(result.from.chainId, "137");
  assert.equal(result.from.address, "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359");
  assert.equal(result.to.chainId, "8453");
});

test("polygon ETH maps to WETH, not native POL", () => {
  const result = resolve("?fromChain=Polygon&fromToken=ETH&toChain=Base&toToken=USDC");
  assert.equal(result.from.address, "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619");
  assert.equal(result.from.chainId, "137");
});

test("missing, partial, or unknown params do not produce a prefill", () => {
  assert.equal(resolve(""), null);
  assert.equal(resolve("?amount=10"), null);
  assert.equal(resolve("?fromChain=Base&fromToken=ETH&amount=1"), null);
  assert.equal(
    resolve("?fromChain=Solana&fromToken=ETH&toChain=Base&toToken=USDC"),
    null
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=DAI&toChain=Base&toToken=USDC"),
    null
  );
  assert.equal(
    resolve("?fromChain=56&fromToken=ETH&toChain=8453&toToken=USDC"),
    null
  );
  assert.equal(
    resolve(
      "?fromChain=Base&fromToken=0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef&toChain=Base&toToken=USDC"
    ),
    null
  );
});

const SQUID_NATIVE_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ARB_USDC_MIXED = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

test("numeric chain ids and token addresses map to the allowlist", () => {
  const result = resolve(
    `?fromChain=8453&toChain=42161&fromToken=${SQUID_NATIVE_ETH}&toToken=${ARB_USDC_MIXED}&amount=100`
  );
  assert.deepEqual(result, { from: BASE_ETH, to: ARB_USDC, amount: "100" });
  assert.equal(JSON.stringify(result).includes(SQUID_NATIVE_ETH), false);
  assert.equal(JSON.stringify(result).includes(ARB_USDC_MIXED), false);
});

test("numeric chain ids still accept token symbols", () => {
  assert.deepEqual(
    resolve("?fromChain=8453&fromToken=ETH&toChain=42161&toToken=USDC"),
    { from: BASE_ETH, to: ARB_USDC }
  );
});

test("an allowlisted address is accepted only on its own chain", () => {
  assert.equal(
    resolve(
      "?fromChain=1&fromToken=0x833589fcd6edb6e08f4c7c32d4f71b54bda02913&toChain=8453&toToken=ETH"
    ),
    null
  );
  assert.equal(
    resolve(
      "?fromChain=137&fromToken=0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee&toChain=8453&toToken=USDC"
    ),
    null
  );
  assert.equal(
    resolve(
      "?fromChain=42161&fromToken=0xff970a61a04b1ca14834a43f5de4533ebddb5cc8&toChain=8453&toToken=ETH"
    ),
    null
  );
});

test("polygon WETH address maps to the allowlisted ETH entry", () => {
  const result = resolve(
    "?fromChain=137&fromToken=0x7ceB23FD6BC0adD59E62ac25578270cfF1b9f619&toChain=10&toToken=ETH"
  );
  assert.equal(result.from.address, "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619");
  assert.equal(result.from.chainId, "137");
  assert.equal(
    JSON.stringify(result).includes("0x7ceB23FD6BC0adD59E62ac25578270cfF1b9f619"),
    false
  );
});

test("caller-supplied addresses are never copied into the result", () => {
  const injected = "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
  const result = resolve(
    `?fromChain=Base&fromToken=ETH&toChain=Base&toToken=USDC&amount=${injected}&fromAddress=${injected}`
  );
  assert.equal(JSON.stringify(result).includes(injected), false);
  assert.equal(result.amount, undefined);
  assert.equal(result.to.address, "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
});

test("amount aliases are human units and invalid amounts are dropped", () => {
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&fromAmount=12.50")
      .amount,
    "12.5"
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&from_amount=0.010")
      .amount,
    "0.01"
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=0").amount,
    undefined
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=-1").amount,
    undefined
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=1e2").amount,
    undefined
  );
  assert.equal(
    resolve("?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=1000000000000000000")
      .amount,
    undefined
  );
  const assetsOnly = resolve(
    "?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=foo"
  );
  assert.deepEqual(assetsOnly, { from: BASE_ETH, to: ARB_USDC });
});

function encodeStart(query) {
  return Buffer.from(query, "utf8").toString("base64url");
}

test("telegram start_param accepts a query string or its base64url form", () => {
  const query = "fromChain=8453&fromToken=ETH&toChain=42161&toToken=USDC&amount=0.25";
  const expected = { from: BASE_ETH, to: ARB_USDC, amount: "0.25" };
  assert.deepEqual(resolve("", query), expected);
  assert.deepEqual(resolve("?tgWebAppPlatform=tdesktop", encodeStart(query)), expected);
  assert.deepEqual(
    resolve("", encodeStart(JSON.stringify({
      fromChain: "8453",
      fromToken: "ETH",
      toChain: "42161",
      toToken: "USDC",
      amount: "0.25",
    }))),
    expected
  );
});

test("explicit query params win over start_param and unknown tokens still fail", () => {
  const start = "fromChain=Ethereum&fromToken=ETH&toChain=Optimism&toToken=ETH&amount=9";
  const result = resolve(
    "?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=2",
    start
  );
  assert.deepEqual(result, { from: BASE_ETH, to: ARB_USDC, amount: "2" });
  assert.equal(
    resolve("", "fromChain=Solana&fromToken=ETH&toChain=Base&toToken=USDC&amount=1"),
    null
  );
  assert.equal(resolve("?tgWebAppStartParam=not-a-payload"), null);
});

test("index.html keeps the integrator line and only disables saved state for a prefill", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const original = execFileSync("git", ["show", "HEAD:index.html"], { encoding: "utf8" });
  const line = (source) => source.split("\n").filter((entry) => entry.includes("integratorId"));
  assert.deepEqual(line(html), line(original));
  assert.equal(line(html).length, 1);
  assert.match(html, /loadPreviousStateFromLocalStorage:\s*true/);
  assert.match(html, /if \(prefill\) \{[\s\S]*loadPreviousStateFromLocalStorage = false/);
  assert.equal(html.includes("console."), false);
  assert.match(html, /src="prefill\.js"/);
});

function widgetBoot(search, startParam) {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const inline = html.match(/<script src="prefill\.js"><\/script>\s*<script>([\s\S]*?)<\/script>/);
  assert.ok(inline, "inline widget script not found");
  const window = {
    location: { search },
    CoinEasySquidPrefill: { resolve },
    Telegram: startParam
      ? {
          WebApp: {
            ready() {},
            expand() {},
            initDataUnsafe: { start_param: startParam },
          },
        }
      : undefined,
  };
  const document = {
    getElementById() {
      throw new Error("the boot script must not touch the DOM");
    },
  };
  const fn = new Function("window", "document", inline[1]);
  fn(window, document);
  const payload = JSON.parse(JSON.stringify(window.__coineasyBoot));
  delete payload.config.integratorId;
  return { payload };
}

function widgetConfig(search, startParam) {
  return widgetBoot(search, startParam).payload.config;
}

test("page config without params keeps saved state and has no initial assets", () => {
  const config = widgetConfig("");
  assert.equal(config.loadPreviousStateFromLocalStorage, true);
  assert.equal("initialAssets" in config, false);
  assert.equal(config.themeType, "dark");
});

test("page config with valid params sets initialAssets, amount, and skips saved state", () => {
  const boot = widgetBoot(
    "?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=12.5"
  );
  assert.equal(boot.payload.config.loadPreviousStateFromLocalStorage, false);
  assert.deepEqual(boot.payload.config.initialAssets, { from: BASE_ETH, to: ARB_USDC });
  assert.equal(boot.payload.amount, "12.5");
  assert.equal(JSON.stringify(boot.payload.config.initialAssets).includes("12.5"), false);
});

test("page config accepts the bot's numeric chain and address link", () => {
  const boot = widgetBoot(
    `?fromChain=8453&toChain=42161&fromToken=${SQUID_NATIVE_ETH}&toToken=${ARB_USDC_MIXED}&amount=100`
  );
  assert.equal(boot.payload.config.loadPreviousStateFromLocalStorage, false);
  assert.deepEqual(boot.payload.config.initialAssets, { from: BASE_ETH, to: ARB_USDC });
  assert.equal(boot.payload.amount, "100");
  assert.equal(JSON.stringify(boot.payload.config.initialAssets).includes(SQUID_NATIVE_ETH), false);
});

test("page config reads a telegram start_param when the URL has no swap query", () => {
  const boot = widgetBoot(
    "",
    "fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=3"
  );
  assert.deepEqual(boot.payload.config.initialAssets, { from: BASE_ETH, to: ARB_USDC });
  assert.equal(boot.payload.amount, "3");
});

test("page config ignores an invalid pair and keeps saved state", () => {
  const boot = widgetBoot("?fromChain=Base&fromToken=ETH&toChain=Solana&toToken=USDC&amount=3");
  assert.equal(boot.payload.config.loadPreviousStateFromLocalStorage, true);
  assert.equal("initialAssets" in boot.payload.config, false);
  assert.equal(boot.payload.amount, "");
});

const BASE_USDC = {
  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
  chainId: "8453",
};
const ARB_ETH = {
  address: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  chainId: "42161",
};

test("telegram start_param accepts a compact chain-token-amount payload", () => {
  const expected = { from: BASE_USDC, to: ARB_ETH, amount: "100" };
  assert.deepEqual(resolve("", "8453-USDC-42161-ETH-100"), expected);
  assert.equal(resolve("", "8453-USDC-42161-ETH-0p05").amount, "0.05");
  assert.equal(resolve("", "56-USDC-8453-ETH-1"), null);
});

test("page config reads a compact telegram start_param", () => {
  const boot = widgetBoot("", "8453-USDC-42161-ETH-100");
  assert.deepEqual(boot.payload.config.initialAssets, { from: BASE_USDC, to: ARB_ETH });
  assert.equal(boot.payload.amount, "100");
});

test("a short custody and fee notice sits directly above the widget", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("./page.css", import.meta.url), "utf8");
  const notice = "CoinEasy는 자금을 보관하지 않아요. 견적에는 CoinEasy 연동 수수료 0.25%가 포함돼요.";
  const marker = `<p class="notice">${notice}</p>`;
  const noticeAt = html.indexOf(marker);
  assert.equal((html.match(/class="notice"/g) || []).length, 1);
  assert.ok(noticeAt > 0);
  assert.match(html.slice(noticeAt + marker.length), /^\s*<main id="squid-root"/);
  for (const word of ["공식", "안전", "수익", "이자", "예치", "APY", "APR", "yield"]) {
    assert.equal(notice.toLowerCase().includes(word.toLowerCase()), false, word);
  }
  const id = html.match(/integratorId:\s*"([^"]+)"/)[1];
  const visible = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  assert.equal(visible.includes(id), false);
  assert.equal(visible.includes(notice), true);
  assert.equal(/0x[a-fA-F0-9]{40}/.test(visible), false);
  assert.match(css, /\.notice \{[^}]*font-size:\s*12px/);
  assert.equal(/\.notice \{[^}]*background/.test(css), false);
});

test("the buy tab is disabled in the widget config", () => {
  for (const [search, start] of [["", ""], ["?fromChain=Base&fromToken=ETH&toChain=Arbitrum&toToken=USDC&amount=1", ""]]) {
    const config = widgetConfig(search, start);
    assert.equal(config.tabs.swap, true);
    assert.equal(config.tabs.buy, false);
    assert.equal(config.tabs.send, false);
  }
});

test("the widget mounts in index.html with no iframe, after the boot script", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  assert.equal(/<iframe/i.test(html), false);
  assert.match(html, /<main id="squid-root"/);
  const bootAt = html.indexOf("window.__coineasyBoot =");
  const mountAt = html.indexOf('<script src="squid-mount.js"></script>');
  assert.ok(bootAt > 0 && mountAt > bootAt, "squid-mount.js must load after the boot script");
  assert.ok(
    html.indexOf("telegram-web-app.js") < mountAt,
    "Telegram script must load before the widget so wallet links use the Telegram path"
  );
});

test("the old widget.html entry forwards to index.html with the same query", () => {
  const widget = readFileSync(new URL("./widget.html", import.meta.url), "utf8");
  assert.match(widget, /location\.replace\("\.\/" \+ window\.location\.search/);
});

test("the mounted widget bundle does not repeat the integrator id", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const widget = readFileSync(new URL("./widget.html", import.meta.url), "utf8");
  const bundle = readFileSync(new URL("./squid-mount.js", import.meta.url), "utf8");
  const entry = readFileSync(new URL("./mount-entry.js", import.meta.url), "utf8");
  const page = readFileSync(new URL("./page.js", import.meta.url), "utf8");
  const id = html.match(/integratorId:\s*"([^"]+)"/)[1];
  for (const source of [widget, bundle, entry, page]) {
    assert.equal(source.includes(id), false);
  }
  assert.match(entry, /fromPrice/);
  assert.match(entry, /__coineasyBoot/);
  assert.equal(html.includes("studio.squidrouter.com"), false);
  assert.equal(html.includes("console."), false);
  assert.equal(page.includes("console."), false);
});

function loadPage(options = {}) {
  const page = readFileSync(new URL("./page.js", import.meta.url), "utf8");
  const opened = [];
  const assigned = [];
  const timers = [];
  const listeners = {};
  const help = { hidden: false };
  const hidden = { value: options.hidden ?? false };
  const location = {
    origin: "https://squidkorea.netlify.app",
    pathname: "/",
    search: "?fromChain=8453&amount=100",
    assign(url) { assigned.push(url); },
  };
  Object.defineProperty(location, "href", {
    get() { return location.origin + location.pathname + location.search; },
    set(url) { assigned.push(url); },
  });
  const platform = options.platform === undefined ? "ios" : options.platform;
  const window = {
    location,
    Telegram: platform == null ? undefined : { WebApp: {
      platform,
      openLink: (url, opts) => opened.push({ url, opts }),
    } },
    open: (url) => {
      if (options.forbidOpen) throw new Error("must not use window.open in Telegram");
      opened.push({ url, opts: "window.open" });
      return null;
    },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    addEventListener: (type, fn) => { (listeners["win:" + type] ||= []).push(fn); },
  };
  const walletRows = options.walletRows || [];
  const walletList = {
    children: walletRows,
    contains(node) {
      return walletRows.some((row) => row === node || row.titleEl === node);
    },
    querySelector: () => null,
  };
  const walletInput = {
    parentElement: { parentElement: { querySelector: (sel) => sel === "ul" ? walletList : null } },
  };
  const elementsById = { "wallet-help": help };
  const bodyChildren = [];
  function recordId(el) { if (el && el.id) elementsById[el.id] = el; }
  function makeEl(tag) {
    const el = {
      tagName: String(tag).toUpperCase(),
      id: "",
      className: "",
      hidden: false,
      _html: "",
      textContent: "",
      value: "",
      style: {},
      children: [],
      firstChild: null,
      parentNode: null,
      isConnected: true,
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; if (k === "id") { this.id = v; recordId(this); } },
      getAttribute(k) { return this.attrs[k] || (k === "id" ? this.id : ""); },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) || (k === "id" && !!this.id); },
      appendChild(child) { this.children.push(child); child.parentNode = this; this.firstChild = this.children[0]; return child; },
      insertBefore(child, _ref) { this.children.unshift(child); child.parentNode = this; this.firstChild = this.children[0]; return child; },
      removeAttribute(k) { delete this.attrs[k]; },
      focus() {},
      select() {},
      scrollIntoView() {},
      querySelector(sel) {
        if (sel && sel.startsWith("#")) return elementsById[sel.slice(1)] || null;
        return null;
      },
    };
    Object.defineProperty(el, "id", {
      get() { return this._id || ""; },
      set(v) { this._id = v; recordId(this); },
      configurable: true,
    });
    Object.defineProperty(el, "innerHTML", {
      get() { return this._html || ""; },
      set(v) {
        this._html = String(v);
        for (const match of this._html.matchAll(/id="([^"]+)"/g)) {
          if (!elementsById[match[1]]) {
            const child = makeEl("div");
            child.id = match[1];
            elementsById[match[1]] = child;
          }
        }
      },
      configurable: true,
    });
    return el;
  }
  const body = makeEl("body");
  body.appendChild = function (child) { bodyChildren.push(child); child.parentNode = body; return child; };
  body.insertBefore = function (child) { bodyChildren.unshift(child); child.parentNode = body; return child; };
  const helpParent = { insertBefore(child) { bodyChildren.unshift(child); child.parentNode = this; return child; } };
  help.parentNode = helpParent;
  const document = {
    hidden: hidden.value,
    documentElement: { _dummy: true },
    body,
    addEventListener: (type, fn, opts) => {
      const key = type + ((opts === true || (opts && opts.capture)) ? ".capture" : "");
      listeners[key] = fn;
    },
    getElementById: (id) => elementsById[id] || null,
    querySelectorAll: (sel) => sel === 'input[placeholder="Select your wallet"]' ? [walletInput] : [],
    querySelector: (sel) => (sel && sel.startsWith("#") ? (elementsById[sel.slice(1)] || null) : null),
    createElement: (tag) => makeEl(tag),
    execCommand: (cmd) => { listeners.execCommand = cmd; return true; },
  };
  document.elementsById = elementsById;
  document.bodyChildren = bodyChildren;
  Object.defineProperty(document, "hidden", { get() { return hidden.value; }, set(v) { hidden.value = v; } });
  if (options.withObserver) {
    window.MutationObserver = class {
      constructor(fn) { this.fn = fn; }
      observe() { this.fn(); }
    };
  }
  new Function("window", "document", page)(window, document);
  const clickKind = (kind) => listeners.click({
    preventDefault() {},
    target: { closest: () => ({ getAttribute: () => kind, hasAttribute: () => false }) },
  });
  const full = "https://squidkorea.netlify.app/?fromChain=8453&amount=100";
  return { opened, assigned, timers, listeners, help, hidden, walletRows, walletList, clickKind, full, window, document, runTimers() { timers.splice(0).forEach((t) => t.fn()); } };
}

test("inside Telegram, wallet buttons try the native app scheme first", () => {
  const { clickKind, assigned, opened, full } = loadPage({ forbidOpen: true, hidden: false });
  clickKind("metamask");
  clickKind("trust");
  clickKind("okx");
  clickKind("browser");
  assert.deepEqual(assigned, [
    "metamask://dapp/squidkorea.netlify.app/?fromChain=8453&amount=100",
    "trust://open_url?coin_id=60&url=" + encodeURIComponent(full),
    "okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(full),
  ]);
  assert.deepEqual(opened, [{ url: full, opts: { try_instant_view: false } }]);
});

test("if the native app does not open, Telegram falls back to the https universal link", () => {
  const env = loadPage({ forbidOpen: true, hidden: false });
  env.clickKind("okx");
  env.clickKind("metamask");
  env.clickKind("trust");
  assert.equal(env.opened.length, 0);
  env.runTimers();
  const full = env.full;
  assert.deepEqual(env.opened, [
    { url: "https://web3.okx.com/download?deeplink=" + encodeURIComponent("okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(full)), opts: { try_instant_view: false } },
    { url: "https://metamask.app.link/dapp/squidkorea.netlify.app/?fromChain=8453&amount=100", opts: { try_instant_view: false } },
    { url: "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(full), opts: { try_instant_view: false } },
  ]);
  env.timers.forEach((t) => assert.equal(t.ms, 1500));
});

test("the https fallback is skipped when the wallet app has already taken over", () => {
  const env = loadPage({ forbidOpen: true, hidden: true });
  env.clickKind("okx");
  env.runTimers();
  assert.deepEqual(env.assigned, ["okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(env.full)]);
  assert.deepEqual(env.opened, []);
});

test("outside Telegram, wallet buttons use the https universal link", () => {
  const env = loadPage({ platform: "unknown" });
  env.clickKind("metamask");
  env.clickKind("trust");
  env.clickKind("okx");
  env.clickKind("browser");
  assert.deepEqual(env.assigned, []);
  assert.deepEqual(env.opened.map((x) => x.url), [
    "https://metamask.app.link/dapp/squidkorea.netlify.app/?fromChain=8453&amount=100",
    "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(env.full),
    "https://web3.okx.com/download?deeplink=" + encodeURIComponent("okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(env.full)),
    env.full,
  ]);
  env.opened.forEach((x) => assert.equal(x.opts, "window.open"));
});

test("inside Telegram, injected wallet rows are hidden and MetaMask is routed to a native link", () => {
  const rows = ["WalletConnect", "MetaMask", "Coinbase Wallet", "Browser Extension", "OKX Wallet"].map((name) => {
    const titleEl = { textContent: name, parentElement: null };
    const row = {
      textContent: name,
      style: { display: "" },
      attrs: {},
      titleEl,
      querySelector: (sel) => sel === ".tw-text-grey-300" ? titleEl : null,
      setAttribute(k, v) { this.attrs[k] = v; },
      parentElement: null,
    };
    titleEl.parentElement = row;
    return row;
  });
  const env = loadPage({ forbidOpen: true, hidden: false, walletRows: rows, withObserver: true });
  assert.equal(rows[0].style.display, "");
  assert.equal(rows[1].style.display, "none");
  assert.equal(rows[2].style.display, "none");
  assert.equal(rows[3].style.display, "none");
  assert.equal(rows[4].style.display, "");
  assert.equal(rows[1].attrs["data-coineasy-hidden"], "1");
  const ev = { prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, target: rows[1].titleEl };
  env.listeners["click.capture"](ev);
  assert.equal(ev.prevented, true);
  assert.equal(ev.stopped, true);
  assert.deepEqual(env.assigned, ["metamask://dapp/squidkorea.netlify.app/?fromChain=8453&amount=100"]);
});

test("inside Telegram, window.open https links go through openLink so WalletConnect can hand off", () => {
  const env = loadPage({ forbidOpen: true });
  const ret = env.window.open("https://example-wallet.app/open", "_blank");
  assert.equal(ret, null);
  assert.deepEqual(env.opened, [{ url: "https://example-wallet.app/open", opts: { try_instant_view: false } }]);
});

test("inside Telegram, a WalletConnect URI opens a QR and copy panel instead of a custom scheme", () => {
  const env = loadPage({ forbidOpen: true });
  const wcUri = "wc:abcd1234-5678-90ef-abcd-1234567890ab@2?relay-protocol=irn&symKey=00";
  assert.equal(env.window.open("metamask://wc?uri=" + encodeURIComponent(wcUri)), null);
  assert.deepEqual(env.assigned, []);
  const panel = env.document.getElementById("coineasy-wc");
  assert.ok(panel);
  assert.equal(panel.hidden, false);
  assert.equal(env.document.getElementById("coineasy-wc-uri").value, wcUri);
  assert.match(panel.innerHTML, /WalletConnect/);
  assert.match(panel.innerHTML, /URI 복사/);
  assert.match(panel.innerHTML, /MetaMask로 연결/);
  assert.match(panel.innerHTML, /OKX로 연결/);
  assert.match(panel.innerHTML, /Trust로 연결/);
});

test("WalletConnect panel buttons open official https universal links through openLink", () => {
  const env = loadPage({ forbidOpen: true });
  const wcUri = "wc:abcd1234-5678-90ef-abcd-1234567890ab@2?relay-protocol=irn&symKey=00";
  env.window.open("https://metamask.app.link/wc?uri=" + encodeURIComponent(wcUri));
  assert.deepEqual(env.opened, []);
  const clickWc = (attr, value) => env.listeners.click({
    preventDefault() {},
    target: {
      closest: (sel) => {
        if (sel.includes("data-wc")) {
          return {
            hasAttribute: (name) => name === attr,
            getAttribute: (name) => (name === "data-wc" ? value : ""),
          };
        }
        return null;
      },
    },
  });
  clickWc("data-wc", "metamask");
  clickWc("data-wc", "okx");
  clickWc("data-wc", "trust");
  const enc = encodeURIComponent(wcUri);
  assert.deepEqual(env.opened, [
    { url: "https://metamask.app.link/wc?uri=" + enc, opts: { try_instant_view: false } },
    { url: "https://www.okx.com/download?deeplink=" + encodeURIComponent("okx://main/wc?uri=" + enc), opts: { try_instant_view: false } },
    { url: "https://link.trustwallet.com/wc?uri=" + enc, opts: { try_instant_view: false } },
  ]);
});

test("index.html loads the QR helper before page.js", () => {
  const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
  const qrAt = html.indexOf('src="qrcode-lite.js"');
  const pageAt = html.indexOf('src="page.js"');
  assert.ok(qrAt > -1 && pageAt > qrAt);
});
