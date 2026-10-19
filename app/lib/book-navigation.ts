/** Page -1 requests the last page of a chapter whose length is not loaded yet. */
export function readerDestination(chapter:number,page:number,pages:number,chapters:number,delta:number) {
 if(page+delta>=0&&page+delta<pages)return {chapter,page:page+delta};
 if(chapter+delta>=0&&chapter+delta<chapters)return {chapter:chapter+delta,page:delta<0?-1:0};
 return null;
}
