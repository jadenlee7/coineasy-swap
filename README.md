# coineasy-swap

CoinEasy x Squid swap, a Telegram Mini App (`t.me/Squid_quiz_bot/swap`).

## What it is

- `index.html` mounts Squid's official widget (`@0xsquid/widget` 8.0.0) directly in the page. Quotes and routes come from Squid's API (`v2.api.squidrouter.com`); transactions can be tracked on `scan.squidrouter.com`.
- No iframe. Squid's wallet code (WalletConnect modal and deep links) checks `window.Telegram` and whether it runs in a frame. In the old iframe it could not see Telegram and tried to navigate the top window, so wallet hand-off failed in Telegram.
- `page.js`: Telegram chrome (black header, vertical swipe off) and "open in wallet app" fallbacks (MetaMask, Trust, Coinbase, browser) through `Telegram.WebApp.openLink`, keeping the same prefill.
- `page.css`: squid.inc tokens (black, `#e6fa36`, lavender `#bc8ee4`). Geist Sans and Pretendard are self-hosted (`fonts/`, OFL). The white Squid monogram and Powered by Squid watermark are from `github.com/0xsquid/assets` (Apache-2.0, see `assets/squid/`).
- `widget.html`: old entry point, forwards to `index.html` with the same query.
- `squid-mount.js`: built from `mount-entry.js` (`cd build && npm install && sh build.sh`).

## Verify / 확인

`node --test prefill.test.mjs`

No query string: the swap widget still loads, and a previous token pair can be restored.

`?fromChain=8453&fromToken=ETH&toChain=42161&toToken=USDC&amount=0.01`

Chains, tokens, and the amount `0.01` are filled. The user signs in their own wallet. Accepted amount names are `amount`, `fromAmount`, and `from_amount` (human token units, not wei). Unknown chains, tokens, or amounts are ignored.

A Telegram mini app can pass the same query string, its base64url form, or a compact `8453-USDC-42161-ETH-100` startapp value (use `p` for a decimal point), as `Telegram.WebApp.initDataUnsafe.start_param` or `tgWebAppStartParam`.

쿼리 없이 열면 위젯이 그대로 뜨고, 이전에 고른 토큰을 복원할 수 있습니다. 위 주소처럼 열면 체인, 토큰, 수량이 채워지고 서명은 내 지갑에서 합니다. 수량은 사람이 읽는 단위입니다. 알 수 없는 체인, 토큰, 수량은 무시합니다.
