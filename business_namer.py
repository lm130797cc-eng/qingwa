import datetime
import sys
from pathlib import Path


def get_bagua_profile(birth_timestamp):
    hour = birth_timestamp.hour
    if 5 <= hour < 7:
        gua, wuxing, yin_yang = "震 ☳", "木", "动"
    elif 7 <= hour < 9:
        gua, wuxing, yin_yang = "离 ☲", "火", "明"
    elif 9 <= hour < 11:
        gua, wuxing, yin_yang = "乾 ☰", "金", "刚"
    elif 11 <= hour < 13:
        gua, wuxing, yin_yang = "坤 ☷", "土", "稳"
    elif 13 <= hour < 15:
        gua, wuxing, yin_yang = "兑 ☱", "金", "悦"
    elif 15 <= hour < 17:
        gua, wuxing, yin_yang = "巽 ☴", "木", "入"
    else:
        gua, wuxing, yin_yang = "坎 ☵", "水", "藏"
    energy_map = {
        "震": "开拓",
        "离": "曝光",
        "乾": "权威",
        "坤": "包容",
        "兑": "喜悦",
        "巽": "渗透",
        "坎": "潜行",
    }
    return {
        "gua": gua,
        "wuxing": wuxing,
        "yin_yang": yin_yang,
        "energy": energy_map.get(gua[0], ""),
    }


def generate_shop_names(industry, element):
    name_bases = {
        "餐饮": ["味", "香", "食", "堂", "轩"],
        "美发": ["型", "尚", "剪", "艺", "阁"],
        "教育": ["智", "学", "启", "文", "思"],
        "电商": ["云", "链", "速", "达", "购"],
    }
    bases = name_bases.get(industry, ["优", "佳", "盛", "隆", "兴"])
    elements = {
        "木": "森、林、东、春",
        "火": "炎、阳、南、夏",
        "土": "坤、城、中、长",
        "金": "鑫、锐、西、秋",
        "水": "海、润、北、冬",
    }
    names = [f"{base}{industry}" for base in bases[:3]]
    return {
        "recommended_names": names,
        "element_tips": f"宜用五行属‘{element}’的字，如：{elements.get(element, '通用')}",
    }


def generate_logo_prompt(shop_name, industry, gua, wuxing):
    color_map = {
        "木": "#228B22",
        "火": "#FF4500",
        "土": "#D2691E",
        "金": "#FFD700",
        "水": "#1E90FF",
    }
    style_map = {
        "震": "dynamic",
        "离": "vibrant",
        "乾": "luxury",
        "坤": "stable",
        "兑": "friendly",
        "巽": "elegant",
        "坎": "mysterious",
    }
    prompt = (
        f"Minimalist logo for '{shop_name}', "
        f"{style_map.get(gua[0], 'modern')} style, "
        f"primary color {color_map.get(wuxing, '#000000')}, "
        f"symbol inspired by {gua}, clean vector, white background"
    )
    return {
        "prompt": prompt,
        "color_suggestion": color_map.get(wuxing, "#000000"),
        "design_style": style_map.get(gua[0], "modern"),
    }


def suggest_lucky_time(birth_date_str):
    base = datetime.datetime.fromisoformat(birth_date_str)
    suggestions = []
    for h in [7, 8, 9, 10, 14, 15, 16]:
        for m in [8, 18]:
            dt = base.replace(hour=h, minute=m, second=0)
            suggestions.append(dt.strftime("%H:%M"))
    return "推荐开业时间：" + ", ".join(suggestions[:6])


def make_business_report(shop_name, industry, open_time_str):
    try:
        open_time = datetime.datetime.fromisoformat(open_time_str)
    except Exception:
        print("❌ 时间格式错误，请使用 YYYY-MM-DDTHH:MM:SS")
        return
    profile = get_bagua_profile(open_time)
    name_result = generate_shop_names(industry, profile["wuxing"])
    logo_prompt = generate_logo_prompt(shop_name, industry, profile["gua"], profile["wuxing"])
    html = f"""
    <html><head><meta charset="utf-8"><title>企业命名报告</title></head>
    <body style="font-family: 'KaiTi', 'STKaiti', serif; background: #f5f3e8; padding: 40px; margin: 0;">
        <div style="max-width: 900px; margin: auto; background: white; border-radius: 15px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
            <header style="background: linear-gradient(135deg, #c6a467, #8b7355); color: white; text-align: center; padding: 40px; border-radius: 15px 15px 0 0;">
                <h1>🏢 企业命名与品牌建议报告</h1>
                <p>蚂蚁军团 × 数学哲学智能系统</p>
            </header>
            <section style="padding: 40px;">
                <h2>📋 基本信息</h2>
                <p><strong>店铺名称：</strong>{shop_name}</p>
                <p><strong>行业类别：</strong>{industry}</p>
                <p><strong>计划开业：</strong>{open_time_str}</p>
                <hr style="margin: 30px 0;">
                <h2>☵ 八卦命盘</h2>
                <p>开业时刻属 <strong>{profile['gua']}</strong>，五行为 <strong>{profile['wuxing']}</strong>，能量特质：<em>{profile['energy']}</em></p>
                <h2>🎯 推荐店名</h2>
                <ul>
    """
    for n in name_result["recommended_names"]:
        html += f"<li>{n} <small>（呼应{profile['wuxing']}行，利于{profile['energy']}）</small></li>"
    html += f"""
                </ul>
                <p>💡 {name_result['element_tips']}</p>
                <h2>🎨 视觉设计建议</h2>
                <p><strong>主色调：</strong> <span style="color:{logo_prompt['color_suggestion']}; font-weight:bold;">■ {logo_prompt['color_suggestion']}</span></p>
                <p><strong>设计风格：</strong> {logo_prompt['design_style']} 风格</p>
                <p><strong>AI 绘图提示词：</strong></p>
                <code style="display:block; background:#f0f0f0; padding:10px; margin:10px 0; border-radius:5px;">
                {logo_prompt['prompt']}
                </code>
                <h2>⏰ 开业吉时</h2>
                <p>{suggest_lucky_time(open_time_str)}</p>
                <p><small>✅ 避开冲煞时段，选择生旺之刻</small></p>
            </section>
            <footer style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 0.9em; color: #666; border-radius: 0 0 15px 15px;">
                报告生成于 {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}<br>
                © 2026 八卦计算机意识系统 · 为企业注入东方智慧
            </footer>
        </div>
    </body></html>
    """
    Path("business_reports").mkdir(exist_ok=True)
    safe_name = shop_name.replace(" ", "_")
    # Shortened filename: BNReport_[Name]_[Date].html
    filename = Path("business_reports") / f"BNReport_{safe_name}_{open_time.strftime('%Y%m%d_%H%M')}.html"
    with open(filename, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"✅ 企业命名报告已生成：{filename}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("📌 使用方法：")
        print("   python business_namer.py <店铺名称> <行业类别> <开业时间>")
        print("   时间格式：YYYY-MM-DDTHH:MM:SS")
        print("   示例：")
        print("   python business_namer.py 晨光小面 餐饮 2026-03-08T09:08:00")
    else:
        shop_name = sys.argv[1]
        industry = sys.argv[2]
        open_time_str = sys.argv[3]
        make_business_report(shop_name, industry, open_time_str)

