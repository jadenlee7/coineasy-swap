(function (root) {
  // Chain names or numeric chain ids, and token symbols or addresses.
  // A value is used only when it matches this allowlist. Config always receives
  // these entries, never the raw query string.
  var CHAINS = {
    ethereum: "1",
    arbitrum: "42161",
    base: "8453",
    optimism: "10",
    polygon: "137"
  };

  var ALLOWED_CHAIN_IDS = {};
  for (var chainName in CHAINS) {
    if (Object.prototype.hasOwnProperty.call(CHAINS, chainName)) {
      ALLOWED_CHAIN_IDS[CHAINS[chainName]] = CHAINS[chainName];
    }
  }

  var NATIVE_ETH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

  var TOKEN_ADDRESSES = {
    eth: {
      "1": NATIVE_ETH,
      "42161": NATIVE_ETH,
      "8453": NATIVE_ETH,
      "10": NATIVE_ETH,
      // Polygon's native asset is POL. Squid lists ETH on Polygon as WETH.
      "137": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619"
    },
    usdc: {
      "1": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      "42161": "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      "8453": "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      "10": "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      "137": "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359"
    }
  };

  var CHAIN_KEYS = ["fromChain", "from_chain"];
  var TO_CHAIN_KEYS = ["toChain", "to_chain"];
  var TOKEN_KEYS = ["fromToken", "from_token"];
  var TO_TOKEN_KEYS = ["toToken", "to_token"];
  // The easyfarm quote button uses `amount` (human units, e.g. 12.5).
  // fromAmount / from_amount match Squid's route field name for the same value.
  var AMOUNT_KEYS = ["amount", "fromAmount", "from_amount"];
  var START_KEYS = ["tgWebAppStartParam", "startapp"];

  function firstRaw(params, names) {
    for (var i = 0; i < names.length; i++) {
      var value = params.get(names[i]);
      if (value != null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  function pick(primary, fallback, names, lower) {
    var value = firstRaw(primary, names) || firstRaw(fallback, names);
    if (!value) return "";
    return lower ? value.toLowerCase() : value;
  }

  function decodeBase64Url(value) {
    if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length < 4) return "";
    var padded = value.replace(/-/g, "+").replace(/_/g, "/");
    while (padded.length % 4) padded += "=";
    try {
      var binary = atob(padded);
      if (/[\u0000-\u0008\u000e-\u001f]/.test(binary)) return "";
      return binary;
    } catch (err) {
      return "";
    }
  }

  function searchFromDecoded(decoded) {
    var text = String(decoded || "").trim();
    if (!text) return "";
    if (text.charAt(0) === "?") text = text.slice(1);
    if (text.charAt(0) !== "{") return text.indexOf("=") === -1 ? "" : text;
    try {
      var obj = JSON.parse(text);
      if (!obj || typeof obj !== "object") return "";
      var params = new URLSearchParams();
      var keys = CHAIN_KEYS.concat(TO_CHAIN_KEYS, TOKEN_KEYS, TO_TOKEN_KEYS, AMOUNT_KEYS);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (obj[key] != null && String(obj[key]).trim() !== "") {
          params.set(key, String(obj[key]).trim());
        }
      }
      return params.toString();
    } catch (err) {
      return "";
    }
  }

  // Plain query strings, and Telegram startapp payloads (query string or base64url).
  function decodeStartParam(value) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.charAt(0) === "?") raw = raw.slice(1);
    if (raw.indexOf("%") !== -1 && raw.indexOf("=") === -1) {
      try {
        raw = decodeURIComponent(raw);
      } catch (err) {
        return "";
      }
    }
    if (raw.indexOf("=") !== -1 || raw.charAt(0) === "{") return searchFromDecoded(raw);
    return searchFromDecoded(decodeBase64Url(raw));
  }

  function resolveChainId(chainRaw) {
    if (CHAINS[chainRaw]) return CHAINS[chainRaw];
    if (ALLOWED_CHAIN_IDS[chainRaw]) return ALLOWED_CHAIN_IDS[chainRaw];
    return "";
  }

  function resolveAsset(chainRaw, tokenRaw) {
    var chainId = resolveChainId(chainRaw);
    if (!chainId) return null;

    var bySymbol = TOKEN_ADDRESSES[tokenRaw];
    if (bySymbol && bySymbol[chainId]) {
      return { address: bySymbol[chainId], chainId: chainId };
    }

    if (!/^0x[0-9a-f]{40}$/.test(tokenRaw)) return null;
    var symbols = ["eth", "usdc"];
    for (var i = 0; i < symbols.length; i++) {
      var canonical = TOKEN_ADDRESSES[symbols[i]][chainId];
      if (canonical === tokenRaw) {
        return { address: canonical, chainId: chainId };
      }
    }
    return null;
  }

  // Human token units for the widget input. Zero, wei blobs, and junk are ignored.
  function normalizeAmount(raw) {
    var value = String(raw || "").trim();
    if (!/^(?:0|[1-9]\d{0,17})(?:\.\d{1,18})?$/.test(value)) return "";
    if (value.indexOf(".") !== -1) {
      value = value.replace(/0+$/, "").replace(/\.$/, "");
    }
    if (!/[1-9]/.test(value)) return "";
    return value;
  }

  function resolve(search, startParam) {
    var params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
    var embedded = decodeStartParam(startParam || firstRaw(params, START_KEYS));
    var fallback = new URLSearchParams(embedded);
    var fromAsset = resolveAsset(
      pick(params, fallback, CHAIN_KEYS, true),
      pick(params, fallback, TOKEN_KEYS, true)
    );
    var toAsset = resolveAsset(
      pick(params, fallback, TO_CHAIN_KEYS, true),
      pick(params, fallback, TO_TOKEN_KEYS, true)
    );
    if (!fromAsset || !toAsset) return null;
    var result = { from: fromAsset, to: toAsset };
    var amount = normalizeAmount(pick(params, fallback, AMOUNT_KEYS, false));
    if (amount) result.amount = amount;
    return result;
  }

  root.CoinEasySquidPrefill = { resolve: resolve };
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.CoinEasySquidPrefill;
}
