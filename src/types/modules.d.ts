declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, options: any);
    loadFromHTML(elements: NodeListOf<HTMLElement> | HTMLElement[]): void;
    loadFromImages(images: string[]): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    turnToPage(pageNum: number): void;
    turnToPrevPage(): void;
    turnToNextPage(): void;
    flip(pageNum: number, corner?: 'top' | 'bottom'): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): 'portrait' | 'landscape';
    getBoundsRect(): any;
    destroy(): void;
    on(event: string, callback: (e: any) => void): void;
    off(event: string): void;
    update(): void;
  }
}

declare module 'pdfjs-dist/build/pdf.mjs' {
  export const version: string;
  export const GlobalWorkerOptions: {
    workerSrc: string;
    workerPort: any;
  };
  export function getDocument(src: any): {
    promise: Promise<any>;
    onProgress?: (progressData: { loaded: number; total: number }) => void;
  };
}
