export function validSetNumbers(weight, reps) {
  return String(weight).trim() !== '' && Number.isFinite(Number(weight)) && Number(weight)>=0 && Number(weight)<10000
    && Math.abs(Number(weight)*100-Math.round(Number(weight)*100))<0.000001
    && String(reps).trim() !== '' && Number.isInteger(Number(reps)) && Number(reps)>=1 && Number(reps)<=1000;
}
