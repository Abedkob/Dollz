declare module 'sharp' {
  namespace sharp {
    interface Metadata {
      format?: string;
      width?: number;
      height?: number;
    }
  }

  interface SharpInstance {
    metadata(): Promise<sharp.Metadata>;
    rotate(): SharpInstance;
    clone(): SharpInstance;
    resize(options: {
      width: number;
      height?: number;
      fit?: 'cover';
      withoutEnlargement?: boolean;
    }): SharpInstance;
    webp(options?: { quality?: number }): SharpInstance;
    jpeg(options?: { quality?: number }): SharpInstance;
    png(): SharpInstance;
    toBuffer(): Promise<Buffer>;
  }

  function sharp(
    input: Buffer,
    options?: { limitInputPixels?: number; failOn?: 'error' },
  ): SharpInstance;

  export default sharp;
}
