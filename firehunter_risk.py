

RISK_KEYWORDS_HIGH = [
    "double", "doubler", "100%", "guaranteed", "instant pay", "秒付", "一夜暴富",
]
RISK_KEYWORDS_MEDIUM = [
    "airdrop", "bonus", "ref", "邀请", "拉新", "无限邀请",
]


def score_telegram_campaign(text):
    lowered = text.lower()
    score = 0
    reasons = []
    for kw in RISK_KEYWORDS_HIGH:
        if kw in lowered:
            score += 40
            reasons.append(f"命中高危关键词: {kw}")
    for kw in RISK_KEYWORDS_MEDIUM:
        if kw in lowered:
            score += 15
            reasons.append(f"命中中危关键词: {kw}")
    if "kYC" in text or "KYC" in text:
        score -= 10
        reasons.append("提及 KYC，略微降低风险")
    if score < 0:
        score = 0
    if score > 100:
        score = 100
    return {"risk_score": score, "reasons": reasons}


def score_defi_protocol(protocol):
    score = 0
    reasons = []
    change_1d = protocol.get("change_1d", 0)
    try:
        change_1d = float(change_1d)
    except Exception:
        change_1d = 0
    if change_1d > 50:
        score += 30
        reasons.append("1 日涨幅 > 50%，波动异常")
    if change_1d < -30:
        score += 20
        reasons.append("1 日跌幅 < -30%，下跌剧烈")
    name = (protocol.get("name") or "").lower()
    if "test" in name or "beta" in name:
        score += 10
        reasons.append("名称中含 test/beta，可能处于早期阶段")
    if score < 0:
        score = 0
    if score > 100:
        score = 100
    return {"risk_score": score, "reasons": reasons}

