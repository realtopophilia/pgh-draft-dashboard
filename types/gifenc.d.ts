declare module 'gifenc' {
  export interface GIFEncoderInstance {
    writeFrame(data: Uint8Array, width: number, height: number, options?: {
      palette?: number[][];
      delay?: number;
      repeat?: number;
      transparent?: boolean;
    }): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): GIFEncoderInstance;
  export function quantize(
    data: Uint8ClampedArray | Uint8Array,
    maxColors: number,
    options?: { format?: string; oneBitAlpha?: boolean }
  ): number[][];
  export function applyPalette(
    data: Uint8ClampedArray | Uint8Array,
    palette: number[][],
    format?: string
  ): Uint8Array;
}
