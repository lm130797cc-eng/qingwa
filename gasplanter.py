import json
import datetime
from pathlib import Path


def generate_invite_poster(campaign_text, project_name=None):
    title = project_name or "今日猎火精选"
    lines = [line.strip() for line in campaign_text.splitlines() if line.strip()]
    main_line = lines[0] if lines else campaign_text[:80]
    return {
        "title": title,
        "headline": main_line,
        "highlights": [
            "官方渠道信息整理，谨防诈骗", 
            "适度参与，注意资金安全", 
        ],
        "cta": "扫码参与或复制链接加入活动",
    }


def load_firehunter_report(path="firehunter_report_today.json"):
    file_path = Path(path)
    if not file_path.exists():
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def run_gasplanter():
    today = datetime.date.today().isoformat()
    report = load_firehunter_report()
    if not report:
        plan = {
            "date": today,
            "status": "no_firehunter_report",
            "message": "未找到当日 firehunter 报告，无法生成邀请海报方案。",
        }
    else:
        telegram = report.get("firehunter_findings", {}).get("telegram_invitation_campaigns", {})
        posters = []
        for url, messages in telegram.items():
            for text in messages[:3]:
                posters.append(
                    {
                        "source": url,
                        "raw_text": text,
                        "poster": generate_invite_poster(text),
                    }
                )
        plan = {
            "date": today,
            "status": "ok",
            "posters": posters,
        }
    with open("gasplanter_plan_today.json", "w", encoding="utf-8") as f:
        json.dump(plan, f, ensure_ascii=False, indent=2)
    print("🌱 种油组已生成今日邀请海报方案")


if __name__ == "__main__":
    run_gasplanter()

