declare module "heic-convert" {
  interface ConvertOptions {
    buffer: Buffer;
    format: string;
    quality?: number;
  }

  function heicConvert(options: ConvertOptions): Promise<Uint8Array>;
  export default heicConvert;
}
