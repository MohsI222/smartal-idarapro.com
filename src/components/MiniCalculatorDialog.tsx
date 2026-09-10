import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: number;
  onApply: (value: number) => void;
  title: string;
};

function safeEvalExpression(expr: string): number | null {
  const s = expr.replace(/\s/g, "").replace(/×/g, "*").replace(/÷/g, "/");
  if (!/^[\d.+\-*/()]+$/.test(s) || /[+\-*/]{2,}/.test(s)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- mini calculator only
    const fn = new Function(`"use strict"; return (${s})`);
    const v = Number(fn());
    return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  } catch {
    return null;
  }
}

export function MiniCalculatorDialog({ open, onOpenChange, initialValue, onApply, title }: Props) {
  const [display, setDisplay] = useState(String(initialValue || 0));

  useEffect(() => {
    if (open) setDisplay(String(initialValue ?? 0));
  }, [open, initialValue]);

  const append = (ch: string) => {
    setDisplay((d) => (d === "0" && /[\d.]/.test(ch) ? ch : d + ch));
  };

  const clear = () => setDisplay("0");

  const equals = () => {
    const v = safeEvalExpression(display);
    if (v != null) setDisplay(String(v));
  };

  const apply = () => {
    const v = safeEvalExpression(display) ?? parseFloat(display.replace(",", "."));
    if (Number.isFinite(v)) {
      onApply(v);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs border-cyan-500/25 bg-[#0f1628]">
        <DialogHeader>
          <DialogTitle className="text-white text-center">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-right font-mono text-xl text-cyan-100 min-h-[3rem] break-all">
            {display}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {["7", "8", "9", "/"].map((k) => (
              <Button key={k} type="button" variant="secondary" className="text-lg font-bold" onClick={() => append(k)}>
                {k === "/" ? "÷" : k}
              </Button>
            ))}
            {["4", "5", "6", "*"].map((k) => (
              <Button key={k} type="button" variant="secondary" className="text-lg font-bold" onClick={() => append(k)}>
                {k === "*" ? "×" : k}
              </Button>
            ))}
            {["1", "2", "3", "-"].map((k) => (
              <Button key={k} type="button" variant="secondary" className="text-lg font-bold" onClick={() => append(k)}>
                {k}
              </Button>
            ))}
            {["0", ".", "+", "="].map((k) => (
              <Button
                key={k}
                type="button"
                variant={k === "=" ? "default" : "secondary"}
                className={`text-lg font-bold ${k === "=" ? "bg-[#0052CC]" : ""}`}
                onClick={() => (k === "=" ? equals() : append(k))}
              >
                {k}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1 border-slate-600" onClick={clear}>
              C
            </Button>
            <Button type="button" className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={() => void apply()}>
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
