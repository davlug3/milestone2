export type PhotoBox = readonly [number, number, number, number];
export interface PhotoPage { photos: string[]; boxes: PhotoBox[] }
const single: PhotoBox[] = [[35,35,442,590]];
const pair: PhotoBox[] = [[35,35,442,288],[35,337,442,288]];
const triples: PhotoBox[][] = [[[35,35,442,338],[35,387,214,238],[263,387,214,238]], [[35,35,214,270],[263,35,214,270],[35,319,442,306]]];
const quad: PhotoBox[] = [[35,35,214,288],[263,35,214,288],[35,337,214,288],[263,337,214,288]];
export function planPhotoPages(photos: readonly string[]): PhotoPage[] {
  const rhythm = [1,2,3,4,2,3];
  const pages: PhotoPage[] = [];
  for(let i=0;i<photos.length;){
    const n=Math.min(rhythm[pages.length%rhythm.length],photos.length-i);
    const boxes=n===1?single:n===2?pair:n===3?triples[pages.length%2]:quad;
    pages.push({photos:photos.slice(i,i+n),boxes});
    i+=n;
  }
  return pages;
}
export function bookSheetCount(pageCount:number):number {
  return Math.max(2,Math.ceil((pageCount+1)/2));
}
