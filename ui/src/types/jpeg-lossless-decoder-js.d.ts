declare module 'jpeg-lossless-decoder-js' {
  export class Decoder {
    constructor();
    decode(
      buffer: ArrayBufferLike,
      offset: number,
      length: number,
      bytesPerToken?: number | null
    ): ArrayBuffer;
  }
}
