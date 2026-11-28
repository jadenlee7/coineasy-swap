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

  function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }

  var USDC_CHAIN_BY_ADDRESS = {};
  for (var usdcChain in TOKEN_ADDRESSES.usdc) {
    if (hasOwn(TOKEN_ADDRESSES.usdc, usdcChain)) {
      USDC_CHAIN_BY_ADDRESS[TOKEN_ADDRESSES.usdc[usdcChain]] = usdcChain;
    }
  }

  var COSMOS_BARE_CHAINS = {
    celestia: true,
    kava: true,
    kichain: true,
    neutron: true,
    nyx: true,
    regen: true,
    sei: true,
    sommelier: true,
    terra: true,
    thorchain: true
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

  // Compact startapp: 8453-USDC-42161-ETH-100 (dot in amount becomes p). Stays under Telegram's 64-char limit.
  var COMPACT = /^(\d{1,9})-([A-Za-z][A-Za-z0-9]{1,9})-(\d{1,9})-([A-Za-z][A-Za-z0-9]{1,9})-([0-9]+(?:p[0-9]+)?)$/;

  function decodeCompact(value) {
    var match = COMPACT.exec(String(value || "").trim());
    if (!match) return "";
    return (
      "fromChain=" + match[1] +
      "&fromToken=" + match[2] +
      "&toChain=" + match[3] +
      "&toToken=" + match[4] +
      "&amount=" + match[5].replace("p", ".")
    );
  }

  // Plain query strings, compact startapp, and Telegram startapp payloads (query string or base64url).
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
    var compact = decodeCompact(raw);
    if (compact) return compact;
    if (raw.indexOf("=") !== -1 || raw.charAt(0) === "{") return searchFromDecoded(raw);
    return searchFromDecoded(decodeBase64Url(raw));
  }

  function resolveChainId(chainRaw) {
    if (hasOwn(CHAINS, chainRaw)) return CHAINS[chainRaw];
    if (hasOwn(ALLOWED_CHAIN_IDS, chainRaw)) return ALLOWED_CHAIN_IDS[chainRaw];
    return "";
  }

  function resolveAllowlistedAsset(chainRaw, tokenRaw) {
    var chainLower = String(chainRaw || "").toLowerCase();
    var tokenLower = String(tokenRaw || "").toLowerCase();
    var chainId = resolveChainId(chainLower);
    if (!chainId) return null;

    var bySymbol = hasOwn(TOKEN_ADDRESSES, tokenLower) ? TOKEN_ADDRESSES[tokenLower] : null;
    if (bySymbol && hasOwn(bySymbol, chainId)) {
      return { address: bySymbol[chainId], chainId: chainId };
    }

    if (!/^0x[0-9a-f]{40}$/.test(tokenLower)) return null;
    var symbols = ["eth", "usdc"];
    for (var i = 0; i < symbols.length; i++) {
      var canonical = TOKEN_ADDRESSES[symbols[i]][chainId];
      if (canonical === tokenLower) {
        return { address: canonical, chainId: chainId };
      }
    }
    return null;
  }

  // Listing buttons always fund from an allowlisted asset (USDC/ETH), while the
  // destination may be any validated Squid catalog token contract/mint/denom.
  function resolveDestinationAsset(chainRaw, tokenRaw) {
    var rawChain = String(chainRaw || "").trim();
    var rawToken = String(tokenRaw || "").trim();
    if (!rawChain || !rawToken) return null;

    var allowlisted = resolveAllowlistedAsset(rawChain, rawToken);
    if (allowlisted) return allowlisted;

    var chainLower = rawChain.toLowerCase();
    var evmChain = resolveChainId(chainLower) || (/^[1-9]\d{0,9}$/.test(chainLower) ? chainLower : "");
    if (evmChain) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(rawToken) || /^0x0{40}$/i.test(rawToken)) {
        return null;
      }
      var lowerAddr = rawToken.toLowerCase();
      if (hasOwn(USDC_CHAIN_BY_ADDRESS, lowerAddr) && USDC_CHAIN_BY_ADDRESS[lowerAddr] !== evmChain) {
        return null;
      }
      if (evmChain === "137" && lowerAddr === NATIVE_ETH) {
        return null;
      }
      return { address: lowerAddr, chainId: evmChain };
    }

    if (chainLower === "solana-mainnet-beta" || chainLower === "solana" || chainLower === "sol") {
      if (/^0x[eE]{40}$/.test(rawToken)) {
        return { address: NATIVE_ETH, chainId: "solana-mainnet-beta" };
      }
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(rawToken)) {
        return { address: rawToken, chainId: "solana-mainnet-beta" };
      }
      return null;
    }

    if (chainLower === "sui-mainnet" || chainLower === "sui") {
      var suiMatch = /^(0x[0-9a-fA-F]{1,64})::([A-Za-z_][A-Za-z0-9_]*)::([A-Za-z_][A-Za-z0-9_]*)$/.exec(rawToken);
      if (!suiMatch) return null;
      return {
        address: suiMatch[1].toLowerCase() + "::" + suiMatch[2] + "::" + suiMatch[3],
        chainId: "sui-mainnet"
      };
    }

    if (chainLower === "xrpl-mainnet" || chainLower === "xrpl") {
      if (rawToken.toLowerCase() === "xrp") {
        return { address: "xrp", chainId: "xrpl-mainnet" };
      }
      var xrplMatch = /^([0-9A-Fa-f]{3,40})\.([1-9A-HJ-NP-Za-km-z]{25,35})$/.exec(rawToken);
      if (!xrplMatch) return null;
      return { address: xrplMatch[1].toUpperCase() + "." + xrplMatch[2], chainId: "xrpl-mainnet" };
    }

    if (chainLower === "stellar-mainnet" || chainLower === "stellar") {
      if (/^C[A-Z2-7]{55}$/.test(rawToken)) {
        return { address: rawToken, chainId: "stellar-mainnet" };
      }
      return null;
    }

    if (chainLower === "bitcoin") {
      if (rawToken.toLowerCase() === "satoshi") {
        return { address: "satoshi", chainId: "bitcoin" };
      }
      return null;
    }

    if (/^[a-z][a-z0-9_]{1,24}-[a-z0-9-]{1,16}$/.test(chainLower) || hasOwn(COSMOS_BARE_CHAINS, chainLower)) {
      var ibcMatch = /^ibc\/([0-9A-Fa-f]{64})$/.exec(rawToken);
      if (ibcMatch) {
        return { address: "ibc/" + ibcMatch[1].toUpperCase(), chainId: chainLower };
      }
      if (/^(?:factory\/[A-Za-z0-9._\/-]{3,120}|[a-z][a-z0-9\/._-]{2,63})$/.test(rawToken)) {
        return { address: rawToken, chainId: chainLower };
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
    var fromAsset = resolveAllowlistedAsset(
      pick(params, fallback, CHAIN_KEYS, true),
      pick(params, fallback, TOKEN_KEYS, true)
    );
    var toAsset = resolveDestinationAsset(
      pick(params, fallback, TO_CHAIN_KEYS, false),
      pick(params, fallback, TO_TOKEN_KEYS, false)
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
