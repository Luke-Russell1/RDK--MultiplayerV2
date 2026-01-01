/*
Includes a number of utility functions, nothing major
*/
export function createTimestamp(timestamp: number) {
  let newTimestamp = Date.now();
  let time = newTimestamp - timestamp;
  return time;
}
export function randomChoice(arr: Array<any>) {
  let choicesArray = [];
  let choice = arr[Math.floor(Math.random() * arr.length)];
  choicesArray.push(choice);
  return choice;
}
export function splitIntoSubarrays(arr: Array<string>, subarrayLength: number) {
  let result = [];
  for (let i = 0; i < arr.length; i += subarrayLength) {
    result.push(arr.slice(i, i + subarrayLength));
  }
  return result;
}
export function count(array: Array<any>, value: any) {
  return array.filter((a) => a === value).length;
}
export function resetDataArray(data: Array<any>) {
  let newData: Array<any> = [];
  return newData;
}
export function deepCopy(obj: any) {
  return JSON.parse(JSON.stringify(obj));
}
