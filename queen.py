import json
import datetime


def get_priority_tasks():
    return [
        {"id": 1, "type": "urgent", "title": "运行猎火组，生成今日报告", "status": "pending"},
        {"id": 2, "type": "critical", "title": "检查 gasplanter_plan_today.json 是否生成", "status": "pending"},
        {"id": 3, "type": "high", "title": "向 TrueChain 运营者发送合作提案", "status": "pending"},
        {"id": 4, "type": "medium", "title": "更新八卦主页 ref.html 页面", "status": "pending"},
    ]


def log_event(event_type, message):
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "type": event_type,
        "message": message,
    }
    with open("system_log.json", "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    print("👑 蚁后系统已启动")
    for task in get_priority_tasks():
        print(f"🎯 {task['id']}. {task['title']} [{task['type']}]")
    log_event("startup", "Queen System initialized")

