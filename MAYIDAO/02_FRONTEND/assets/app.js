// MAYIDAO - Core Logic (App.js)
// Lightweight, Single Page Application (SPA) feel

const App = {
  state: {
    user: null,
    currentService: null,
    report: null,
  },

  init() {
    console.log("MAYIDAO Initialized");
    this.renderHome();
    this.setupEventListeners();
  },

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('.nav-link')) {
        e.preventDefault();
        const page = e.target.getAttribute('href').substring(1);
        this.navigateTo(page);
      }
    });
  },

  navigateTo(page) {
    console.log(`Navigating to ${page}`);
    // Simple routing logic
    if (page === 'service') this.renderService();
    else if (page === 'report') this.renderReport();
    else this.renderHome();
  },

  renderHome() {
    const main = document.querySelector('main');
    main.innerHTML = `
      <div class="card text-center">
        <h2>🔮 AI 易经算命</h2>
        <p>融合传统智慧与现代科技</p>
        <a href="#service" class="btn nav-link">开始测算</a>
      </div>
      <div class="card text-center">
        <h2>🏢 企业取名</h2>
        <p>助您开启商业宏图</p>
        <a href="#service" class="btn nav-link btn-secondary">立即体验</a>
      </div>
      <div class="card text-center" style="border:1px dashed #ccc;">
        <h3>🧧 邀请好友</h3>
        <p>邀请 3 人即可免费解锁报告</p>
        <button class="btn btn-secondary" onclick="App.share()">生成海报</button>
      </div>
    `;
  },

  renderService() {
    const main = document.querySelector('main');
    main.innerHTML = `
      <h2>填写信息</h2>
      <form id="namingForm">
        <div class="form-group">
          <label>姓名</label>
          <input type="text" id="name" placeholder="请输入姓名" required style="width:100%; padding:10px; margin:5px 0;">
        </div>
        <div class="form-group">
          <label>生辰</label>
          <input type="datetime-local" id="birth" required style="width:100%; padding:10px; margin:5px 0;">
        </div>
        <button type="submit" class="btn">生成报告</button>
      </form>
      <div id="loading" class="hidden text-center" style="margin-top:20px;">
        <p>⚡ 正在连接宇宙能量场...</p>
      </div>
    `;

    document.getElementById('namingForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
  },

  async handleFormSubmit() {
    document.getElementById('loading').classList.remove('hidden');
    // Simulate API Call
    await new Promise(r => setTimeout(r, 2000));
    
    // Mock Result
    this.state.report = {
      name: document.getElementById('name').value,
      score: 95,
      summary: "天时地利人和，大吉之兆。",
    };
    
    this.navigateTo('report');
  },

  renderReport() {
    if (!this.state.report) return this.navigateTo('home');
    
    const main = document.querySelector('main');
    main.innerHTML = `
      <div class="card" style="border-top: 4px solid gold;">
        <h2 class="text-center">✨ 测算结果</h2>
        <p>缘主：<strong>${this.state.report.name}</strong></p>
        <div style="background:#f9f9f9; padding:15px; border-radius:5px;">
          <h3 class="text-center" style="color:#d4af37;">${this.state.report.score} 分</h3>
          <p>${this.state.report.summary}</p>
        </div>
        <div class="card" style="margin-top:20px; background:#fff8e1; border:1px solid #ffe0b2;">
          <p class="text-center">🔓 解锁完整报告 (含流年运势)</p>
          <button class="btn" onclick="App.pay()">¥9.9 立即解锁</button>
        </div>
      </div>
      <a href="#home" class="btn btn-secondary nav-link">返回首页</a>
    `;
  },

  share() {
    alert("模拟分享：已生成邀请海报！(Phase 2 Feature)");
  },

  pay() {
    alert("模拟支付：调起微信支付... (Phase 1 Feature)");
  }
};

// Initialize on load
window.addEventListener('DOMContentLoaded', () => App.init());
