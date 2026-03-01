import requests
from bs4 import BeautifulSoup


def scan_telegram_channel(url: str):
    try:
        res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        if res.status_code != 200:
            return [f"无法访问，状态码 {res.status_code}"]
        soup = BeautifulSoup(res.text, "html.parser")
        posts = soup.find_all("div", class_="tgme_widget_message_text")[:20]
        results = []
        for p in posts:
            text = p.get_text(separator=" ", strip=True)
            lowered = text.lower()
            if "ref" in lowered or "invite" in lowered or "邀请" in text:
                results.append(text)
        if not results:
            return ["近期未发现明显邀请/拉新文案"]
        return results
    except Exception as e:
        return [f"无法访问，错误：{e}"]


def collect_telegram_campaigns(urls):
    reports = {}
    for url in urls:
        if "t.me" in url:
            reports[url] = scan_telegram_channel(url)
    return reports

