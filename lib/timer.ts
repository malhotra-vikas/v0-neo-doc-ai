export class Timer {
  private startTime: number;
  private endTime: number;

  constructor() {
    this.startTime = 0;
    this.endTime = 0;
  }

  start(): void {
    this.startTime = performance.now();
  }

  end(): number {
    this.endTime = performance.now();
    return this.getDuration();
  }

  private getDuration(): number {
    return Math.round(this.endTime - this.startTime);
  }
}