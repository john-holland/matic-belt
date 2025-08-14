declare module 'fft-js' {
  export class FFT {
    constructor(size: number);
    forward(real: Float32Array, imag: Float32Array): void;
  }
} 