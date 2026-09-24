import type { Scene, SceneContext } from '../app/scene';
import { PondScene } from './pondScene';

/** 画面注册表：网址参数 ?scene= 用这里的名字 */
const SCENES: Record<string, (ctx: SceneContext) => Scene> = {
  pond: (ctx) => new PondScene(ctx),
};

export function createScene(name: string, ctx: SceneContext): Scene {
  const factory = SCENES[name] ?? SCENES.pond!;
  return factory(ctx);
}

export const SCENE_NAMES = Object.keys(SCENES);
