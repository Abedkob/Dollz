// Hand-written declaration for the ported DollHero.js module. TypeScript
// cannot precisely infer the controller's shape from the plain-JS source
// (it has two structurally different `return` branches -- WebGL-supported
// vs. the no-op fallback -- so inference collapses to `object`). This
// describes the subset of the real API that Dollz code actually calls.

export interface DollHeroColors {
  skin?: string;
  hair?: string;
  eyes?: string;
  dress?: string;
  lace?: string;
  blush?: string;
  shoes?: string;
  socks?: string;
  bow?: string;
  name_embroidery?: string;
}

export interface DollHeroState {
  supported: boolean;
  quality?: string;
  size?: string;
  name?: string;
  colors?: DollHeroColors;
  paused?: boolean;
  reducedMotion?: boolean;
  triangles?: number;
}

export interface DollHeroController {
  readonly ready: Promise<DollHeroController>;
  readonly supported: boolean;
  readonly quality?: string;
  readonly element?: HTMLCanvasElement;
  setSpin(radians: number): void;
  setName(name: string): string | void;
  setColors(colors: DollHeroColors): DollHeroColors | null | void;
  setSize(size: '25' | '40'): void;
  resetAppearance(): void;
  resetCamera(): void;
  pause(): void;
  resume(): void;
  isPaused(): boolean;
  capturePreview(options?: {
    width?: number;
    height?: number;
    transparent?: boolean;
    focus?: 'full' | 'face' | 'name' | 'shoes' | null;
  }): Promise<Blob>;
  getState(): DollHeroState;
  dispose(): void;
}

export interface DollHeroOptions {
  size?: '25' | '40';
  name?: string;
  background?: string | null;
  autorotate?: boolean;
  quality?: 'high' | 'medium' | 'low' | null;
  debug?: boolean;
}

export declare function createDollHero(
  container: HTMLElement,
  options?: DollHeroOptions,
): DollHeroController;

export declare const DEFAULT_COLORS: Required<DollHeroColors>;
export declare function validateColor(value: unknown): string | null;
export declare function sanitizeName(value: unknown): string;
export declare const MAX_NAME_LENGTH: number;
export declare const SIZES: Record<'25' | '40', Record<string, number>>;
