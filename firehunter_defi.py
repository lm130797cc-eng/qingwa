import requests


def _change_1d(protocol):
    value = protocol.get("change_1d")
    if value is None:
        return 0
    try:
        return float(value)
    except Exception:
        return 0


def get_top_defi_growers(limit=5):
    try:
        res = requests.get("https://api.llama.fi/protocols", timeout=30)
        if res.status_code != 200:
            return [{"error": f"DefiLlama 接口状态码 {res.status_code}"}]
        protocols = res.json()
        top_gainers = sorted(protocols, key=_change_1d, reverse=True)[:limit]
        result = []
        for p in top_gainers:
            result.append(
                {
                    "name": p.get("name"),
                    "url": p.get("url"),
                    "change_1d": _change_1d(p),
                    "symbol": p.get("symbol"),
                    "category": p.get("category"),
                }
            )
        return result
    except Exception as e:
        return [{"error": f"DefiLlama 接口异常：{e}"}]

