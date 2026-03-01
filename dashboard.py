from pathlib import Path
import json


def load_firehunter_report():
    path = Path("firehunter_report_today.json")
    if not path.exists():
        return {"date": "N/A", "firehunter_findings": {}}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def generate_dashboard():
    report = load_firehunter_report()
    date = report.get("date", "N/A")
    findings = report.get("firehunter_findings", {})
    tg = findings.get("telegram_invitation_campaigns", {})
    html = f"""
    <html><head><meta charset="utf-8"><title>🐜 蚂蚁军团指挥中心</title></head>
    <body style="font-family: sans-serif; padding: 20px;">
        <h1>🐜 蚂蚁军团指挥中心</h1>
        <p><strong>日期：</strong>{date}</p>
        <h2>🔥 今日猎火情报</h2>
        <ul>
    """
    for url, msgs in tg.items():
        for msg in msgs[:2]:
            snippet = msg[:100].replace("<", "&lt;").replace(">", "&gt;")
            html += f"<li>{snippet}...</li>"
    html += """
        </ul>
        <h2>🌱 种油计划</h2>
        <p>已生成海报方案，可用于推广。</p>
        <h2>⛽ GAS 燃料状态</h2>
        <progress value="70" max="100"></progress> 70% 可用
        <p>已发放：<strong>5000 GAS</strong></p>
        <h2>💰 外部 U 兑换通道</h2>
        <p>✅ TrueChain 合作中（预计收益：20U）</p>
        <p>🟡 OCBC 待确认</p>
        <h2>✍️ AI 八卦取名服务</h2>
        <p>支持定制化宝宝取名报告，融合出生时间与五行平衡。</p>
        <p><code>python name_generator_v2.py 姓名 性别 年 月 日 时 分</code></p>
        <p>💡 可用于接单变现，建议收费：88 元/份</p>
        <h2>🚨 系统日志</h2>
        <textarea rows="6" style="width:100%;;">请查看 system_log.json</textarea>
    </body></html>
    """
    with open("dashboard.html", "w", encoding="utf-8") as f:
        f.write(html)
    print("📊 仪表盘已生成：dashboard.html")


if __name__ == "__main__":
    generate_dashboard()
