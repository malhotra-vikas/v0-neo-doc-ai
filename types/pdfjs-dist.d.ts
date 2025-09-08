declare module "pdfjs-dist/legacy/build/pdf.js" {
  export * from "pdfjs-dist";
  export namespace GlobalWorkerOptions {
    let workerSrc: string;
  }
  interface DocumentInitParameters {
    disableWorker?: boolean;
    isEvalSupported?: boolean;
    useSystemFonts?: boolean;
  }
}
