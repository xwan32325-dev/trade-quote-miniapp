// 微信小程序自定义 tabBar（原生组件，由 uni-app 原样拷贝到产物根目录 custom-tab-bar/）
// 说明：微信原生 tabBar 字体大小写死 10px，只能靠自定义 tabBar 放大字号。
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/quote/index', text: '报价' },
      { pagePath: '/pages/loading/index', text: '装柜' },
      { pagePath: '/pages/ai/index', text: 'AI邮件' },
      { pagePath: '/pages/history/index', text: '记录' }
    ]
  },

  attached() {
    this.syncSelected();
  },

  methods: {
    // 每个 tab 页都会挂载一份自己的 tabbar 实例，挂载时按当前路由算出选中项，
    // 因此不需要在每个页面里写 getTabBar().setData()
    syncSelected() {
      try {
        const pages = getCurrentPages();
        const current = pages[pages.length - 1];
        const route = (current && (current.route || (current.$page && current.$page.route))) || '';
        const idx = this.data.list.findIndex((item) => item.pagePath === '/' + route);

        if (idx >= 0) {
          this.setData({ selected: idx });
        }
      } catch (e) {
        // 取不到路由时保持默认选中第一项
      }
    },

    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const url = this.data.list[index].pagePath;

      if (index === this.data.selected) return;

      this.setData({ selected: index });
      wx.switchTab({ url });
    }
  }
});
