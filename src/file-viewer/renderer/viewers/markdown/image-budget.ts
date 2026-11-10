// One document bounds concurrent image reads and decoded pixels together (../../../README.md).
export class ImageBudget {
  private bytes = 0;
  private pixels = 0;
  private images = 0;
  reserve(bytes: number) {
    if (!Number.isSafeInteger(bytes) || bytes < 0 || this.images >= 32 || this.bytes + bytes > 16 * 1024 * 1024)
      throw new Error('Markdown images exceed the preview limit (32 images and 16 MiB in total).');
    this.bytes += bytes; this.images++;
    let pixels = 0, disposed = false;
    return {
      dimensions: (width: number, height: number) => {
        if (disposed) return;
        const next = width * height;
        if (this.pixels - pixels + next > 16_000_000) throw new Error('Markdown images exceed 16 million pixels in total.');
        this.pixels += next - pixels; pixels = next;
      },
      dispose: () => { if (!disposed) { disposed = true; this.bytes -= bytes; this.pixels -= pixels; this.images--; } },
    };
  }
}
