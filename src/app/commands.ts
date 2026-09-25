/**
 * 界面发给游戏的指令。界面不直接改游戏数据，只发指令；当前画面或 Game 负责执行。
 */
export type GameCommand =
  | { type: 'goto'; scene: string }
  /** 从地图去某个地方（花掉路上的时间） */
  | { type: 'travel'; placeId: string }
  /** 回家睡觉，结束今天 */
  | { type: 'sleep' }
  /** 清掉存档重新开始 */
  | { type: 'newGame' }
  /** 看完一天的小结，起床 */
  | { type: 'dismissSummary' }
  /** 打开外公笔记（图鉴和成就）：让 Game 把最新的内容填进界面 */
  | { type: 'openNotebook' }
  /** 打开添置面板（新手引导要知道玩家看过没有） */
  | { type: 'openUpgrades' }
  /** 小满的便条：关掉 / 重新打开 */
  | { type: 'tutorial'; show: boolean }
  /** 买一项升级（渔具、修缮老宅、装修小馆） */
  | { type: 'buyUpgrade'; upgradeId: string }
  | { type: 'selectBait'; baitId: string }
  | { type: 'selectPosition'; positionId: string }
  | { type: 'catchDecision'; keep: boolean }
  | { type: 'toggleWatch' }
  /** 菜地：手里换一样东西（hand、compost、seed:作物id） */
  | { type: 'selectTool'; toolId: string }
  /** 在家里加工（磨面粉、和面饵、点豆腐） */
  | { type: 'craft'; craftId: string }
  /** 小馆：定菜单 */
  | { type: 'setMenu'; recipeIds: string[] }
  /** 小馆：鱼护里的鱼放进活鱼缸 */
  | { type: 'toTank'; uid: number | 'all' }
  /** 周叔的鱼摊：卖鱼 */
  | { type: 'sellFish'; uid: number }
  /** 阿婆的杂货铺：买东西 */
  | { type: 'buy'; itemId: string; count: number }
  /** 小馆：开门营业 / 在店里忙到傍晚 / 开关小满代班 */
  | { type: 'openShop' }
  /** 小馆：提前打烊；看完今晚的账本 */
  | { type: 'closeShop' }
  | { type: 'dismissNightReport' }
  | { type: 'skipToEvening' }
  | { type: 'toggleHelper' }
  /** 小馆：给这位客人做菜；做菜小游戏里按一下 */
  | { type: 'cookFor'; guestId: number }
  | { type: 'cookHit' }
  /** 鱼护里的鱼放进自家鱼塘（all = 能放的全放） */
  | { type: 'releaseToPond'; uid: number | 'all' }
  /** 鱼护里的鱼放生 */
  | { type: 'releaseToWild'; uid: number }
  | {
      type: 'debug';
      action: 'addHour' | 'cycleWeather' | 'sleep' | 'spawnRare' | 'setParam';
      key?: string;
      value?: number;
    };

export type CommandListener = (cmd: GameCommand) => void;

export class CommandBus {
  private readonly listeners = new Set<CommandListener>();

  send(cmd: GameCommand): void {
    for (const l of [...this.listeners]) l(cmd);
  }

  on(listener: CommandListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
