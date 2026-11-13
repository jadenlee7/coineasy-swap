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

test("wallet app links keep the same swap and go through Telegram openLink", () => {
  const page = readFileSync(new URL("./page.js", import.meta.url), "utf8");
  const opened = [];
  const listeners = {};
  const help = { hidden: false };
  const window = {
    location: { origin: "https://squidkorea.netlify.app", pathname: "/", search: "?fromChain=8453&amount=100" },
    Telegram: { WebApp: { platform: "ios", openLink: (url) => opened.push(url) } },
    open: () => { throw new Error("must use openLink in Telegram"); },
  };
  const document = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    getElementById: () => help,
  };
  new Function("window", "document", page)(window, document);
  const click = (kind) => listeners.click({
    preventDefault() {},
    target: { closest: () => ({ getAttribute: () => kind, hasAttribute: () => false }) },
  });
  click("metamask");
  click("trust");
  click("coinbase");
  click("browser");
  const full = "https://squidkorea.netlify.app/?fromChain=8453&amount=100";
  assert.deepEqual(opened, [
    "https://metamask.app.link/dapp/squidkorea.netlify.app/?fromChain=8453&amount=100",
    "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(full),
    "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(full),
    full,
  ]);
});
