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

  function firstParam(params, names) {
    for (var i = 0; i < names.length; i++) {
      var value = params.get(names[i]);
      if (value != null && String(value).trim() !== "") {
        return String(value).trim().toLowerCase();
      }
    }
    return "";
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

  function resolve(search) {
    var raw = String(search || "");
    if (raw.charAt(0) === "?") raw = raw.slice(1);
    var params = new URLSearchParams(raw);
    var fromAsset = resolveAsset(
      firstParam(params, ["fromChain", "from_chain"]),
      firstParam(params, ["fromToken", "from_token"])
    );
    var toAsset = resolveAsset(
      firstParam(params, ["toChain", "to_chain"]),
      firstParam(params, ["toToken", "to_token"])
    );
    if (!fromAsset || !toAsset) return null;
    return { from: fromAsset, to: toAsset };
  }

  root.CoinEasySquidPrefill = { resolve: resolve };
})(typeof globalThis !== "undefined" ? globalThis : this);

if (typeof module !== "undefined" && module.exports) {
  module.exports = globalThis.CoinEasySquidPrefill;
}
