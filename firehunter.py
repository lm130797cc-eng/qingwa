import json
import datetime

from firehunter_telegram import collect_telegram_campaigns
from firehunter_defi import get_top_defi_growers
from firehunter_nft import scan_nft_opportunities
from firehunter_risk import score_telegram_campaign, score_defi_protocol


TARGETS = [
    "https://t.me/s/airdropofficialnews",
    "https://t.me/s/cnairdrop",
    "https://defillama.com/chain/Ethereum",
]


def run_firehunter():
    today = datetime.date.today().isoformat()
    telegram_reports = collect_telegram_campaigns(TARGETS)
    telegram_risks = {}
    for url, messages in telegram_reports.items():
        scored = []
        for text in messages:
            scored.append({"text": text, "risk": score_telegram_campaign(text)})
        telegram_risks[url] = scored
    defi_list = get_top_defi_growers(limit=5)
    defi_with_risk = []
    for item in defi_list:
        if "error" in item:
            defi_with_risk.append(item)
        else:
            defi_with_risk.append({"protocol": item, "risk": score_defi_protocol(item)})
    nft_info = scan_nft_opportunities()
    report = {
        "date": today,
        "firehunter_findings": {
            "telegram_invitation_campaigns": telegram_reports,
            "telegram_risk_analysis": telegram_risks,
            "top_defi_growers": defi_with_risk,
            "nft_opportunities": nft_info,
        },
    }
    with open("firehunter_report_today.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("✅ 猎火组已完成今日侦察任务")


if __name__ == "__main__":
    run_firehunter()

