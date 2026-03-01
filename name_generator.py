import datetime
from pathlib import Path


def get_bagua_profile(birth_timestamp):
    hour = birth_timestamp.hour
    if 3 <= hour < 7:
        gua = "震 ☳ (雷)"
    elif 7 <= hour < 11:
        gua = "离 ☲ (火)"
    elif 11 <= hour < 15:
        gua = "坤 ☷ (地)"
    elif 15 <= hour < 19:
        gua = "兑 ☱ (泽)"
    else:
        gua = "坎 ☵ (水)"
    wuxing_tips = {
        "震": "宜用‘木’字旁，增强生机",
        "离": "宜用‘日’‘光’类字，助运昌盛",
        "坤": "宜稳重之名，如安、宁、厚",
        "兑": "宜用‘金’‘玉’类字，增贵气",
        "坎": "宜用‘水’‘雨’类字，顺势而为",
    }
    return {
        "gua": gua,
        "element": gua.split(" ")[-1][1],
        "tip": wuxing_tips.get(gua[0], ""),
        "lucky_letters": ["a", "e", "i"],
    }


def generate_names(base_name, profile):
    variants = [
        f"{base_name}轩",
        f"{base_name}睿",
        f"{base_name}宸",
        f"{base_name}霖",
        f"{base_name}锦",
        f"{base_name}哲",
    ]
    return variants


def make_report(name, gender, birthday_str):
    birth = datetime.datetime.fromisoformat(birthday_str)
    profile = get_bagua_profile(birth)
    names = generate_names(name, profile)
    html = f"""
    <html><head><meta charset="utf-8"><title>宝宝取名报告</title></head>
    <body style="font-family: 'Microsoft YaHei'; padding: 30px;">
        <h1>🧧 宝宝取名分析报告</h1>
        <p><strong>姓名：</strong>{name}</p>
        <p><strong>性别：</strong>{gender}</p>
        <p><strong>出生时间：</strong>{birthday_str}</p>
        <hr>
        <h2>☵ 八卦命盘</h2>
        <p>生于{birth.strftime('%H:%M')}，属 {profile['gua']}，五行主 {profile['element']}</p>
        <p>👉 {profile['tip']}</p>
        <h2>🎯 推荐名字</h2>
        <ul>
    """
    for n in names:
        html += f"<li>{n} <small>（音律优美，五格吉利）</small></li>"
    html += f"""
        </ul>
        <h2>📜 命理解读</h2>
        <p>此名生于{profile['gua']}，格局清正，宜早立目标。青年时期多变动，中年后渐入佳境。名字中带‘{profile['element']}’元素者，可增运势。</p>
        <footer style="margin-top: 40px; color: #666; font-size: 0.9em;">
            报告生成于 {datetime.datetime.now().isoformat()}<br>
            © 2026 八卦计算机意识系统 · 数学哲学驱动的智能命名
        </footer>
    </body></html>
    """
    with open(f"report_{name}.html", "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ 报告已生成：report_{name}.html")


if __name__ == "__main__":
    make_report("子涵", "男", "2026-03-01T06:30:00")

