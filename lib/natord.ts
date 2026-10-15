function readDigitRun(s: string, i: number): [string, number] {
  let num = "";
  while (i < s.length && isDigit(s[i])) {
    num += s[i];
    i++;
  }
  return [num, i];
}

export function compare(a: string, b: string): number {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ac = a[i];
    const bc = b[j];
    if (isDigit(ac) && isDigit(bc)) {
      const [aNum, ai] = readDigitRun(a, i);
      const [bNum, bj] = readDigitRun(b, j);
      i = ai;
      j = bj;

      const aTrim = aNum.replace(/^0+/, "") || "0";
      const bTrim = bNum.replace(/^0+/, "") || "0";
      if (aTrim.length !== bTrim.length) {
        return aTrim.length - bTrim.length;
      }
      const cmp = aTrim < bTrim ? -1 : aTrim > bTrim ? 1 : 0;
      if (cmp !== 0) return cmp;
      continue;
    }
    const al = ac.toLowerCase();
    const bl = bc.toLowerCase();
    if (al !== bl) return al < bl ? -1 : 1;
    i++;
    j++;
  }
  return a.length - i - (b.length - j);
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}
