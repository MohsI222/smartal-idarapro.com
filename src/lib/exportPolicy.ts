/** سياسة التصدير — تجربة مجانية = علامة مائية على PDF */

let trialWatermarkActive = false;

export function setTrialWatermarkExport(active: boolean): void {
  trialWatermarkActive = active;
}

export function isTrialWatermarkExport(): boolean {
  return trialWatermarkActive;
}
