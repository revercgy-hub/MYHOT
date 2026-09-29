// 上游专用扩展模块在本行业均已关闭。
// 关掉以后：导航里不再出现入口，对应的定时任务不再运行，页面与接口返回 404。

export const FEATURES = {
  /** 上游公开评测榜单模块。 */
  leaderboard: false,
  /** 上游额度重置提醒模块。 */
  codexResetMonitor: false,
} as const;
