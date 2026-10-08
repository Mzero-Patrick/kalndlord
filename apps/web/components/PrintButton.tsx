"use client";

export function PrintButton() {
  return <div><button className="secondary" onClick={() => window.print()}>Print or save as PDF</button></div>;
}
