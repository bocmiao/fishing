/**
 * 界面发给游戏的指令。界面不直接改游戏数据，只发指令；当前画面或 Game 负责执行。
 */
export type GameCommand =
  | { type: 'goto'; scene: string }
  | { type: 'selectBait'; baitId: string }
  | { type: 'selectPosition'; positionId: string }
  | { type: 'catchDecision'; keep: boolean }
  | { type: 'toggleWatch' }
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
