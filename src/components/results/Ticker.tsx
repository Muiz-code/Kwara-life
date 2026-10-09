"use client";
// A number that rolls up to its new value instead of jumping.
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";

export function Ticker({ value, className }: { value: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("en-NG"));
  useEffect(() => {
    const run = animate(mv, value, { duration: reduce ? 0 : 0.9, ease: "easeOut" });
    return () => run.stop();
  }, [mv, value, reduce]);
  return <motion.span className={className ? `tabular-nums ${className}` : "tabular-nums"}>{text}</motion.span>;
}
