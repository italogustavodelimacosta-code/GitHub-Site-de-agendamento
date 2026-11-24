import type { Service, Size } from "./types.ts";

export const round5 = (v: number) => Math.round(v / 5) * 5;

/** Preço de um serviço, ajustado pelo tamanho do carro quando houver. */
export function priceOf(s: Service, size?: Size | null): number {
  const base = Number(s.price);
  return size ? round5(base * size.k) : base;
}
export function costOf(s: Service, size?: Size | null): number {
  const base = Number(s.cost);
  return size ? Math.round(base * size.k * 100) / 100 : base;
}
export function quote(services: Service[], size: Size | null, pickupFee: number) {
  const items = services.map(s => ({ name: s.name, price: priceOf(s, size), cost: costOf(s, size) }));
  if (pickupFee > 0) items.push({ name: "Leva e traz", price: pickupFee, cost: 0 });
  const total = items.reduce((a, b) => a + b.price, 0);
  const cost = items.reduce((a, b) => a + b.cost, 0);
  const duration = services.reduce((a, s) => a + s.duration_min, 0);
  return { items, total, cost, duration };
}
export const brl = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
