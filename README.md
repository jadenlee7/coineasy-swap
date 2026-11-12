# coineasy-swap
CoinEasy Squid Widget - Telegram Mini App (GitHub Pages)

## Verify / 확인

No query string: the swap widget still loads, and a previous token pair can be restored.

`?fromChain=8453&fromToken=ETH&toChain=42161&toToken=USDC&amount=0.01`

Chains, tokens, and the amount `0.01` are filled. The user signs in the widget. Accepted amount names are `amount`, `fromAmount`, and `from_amount` (human token units, not wei). Unknown chains, tokens, or amounts are ignored.

A Telegram mini app can pass the same query string, or its base64url form, as `Telegram.WebApp.initDataUnsafe.start_param` or `tgWebAppStartParam`.

쿼리 없이 열면 위젯이 그대로 뜨고, 이전에 고른 토큰을 복원할 수 있습니다. 위 주소처럼 열면 체인, 토큰, 수량이 채워지고 서명은 위젯 안에서 합니다. 수량은 사람이 읽는 단위입니다. 알 수 없는 체인, 토큰, 수량은 무시합니다.
