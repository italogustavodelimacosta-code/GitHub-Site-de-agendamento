import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSlots } from "../lib/slots.ts";
import { localToDate, dateToLocal } from "../lib/time.ts";
import { toWhatsApp } from "../lib/phone.ts";
import { quote } from "../lib/pricing.ts";
import { hashPassword, verifyPassword } from "../lib/auth.ts";
import { createHash } from "node:crypto";

const base = { date: "2026-12-01", tz: "-03:00", stepMin: 30, durationMin: 60, closedWeekdays: [0], now: new Date("2026-11-30T12:00:00Z") };

test("horário local vira UTC certo (Brasília -3)", () => {
  assert.equal(localToDate("2026-12-01", 9 * 60, "-03:00").toISOString(), "2026-12-01T12:00:00.000Z");
  assert.deepEqual(dateToLocal(new Date("2026-12-02T02:30:00Z"), "-03:00"), { date: "2026-12-01", minutes: 23 * 60 + 30, weekday: 2 });
});

test("lava-rápido: 6h à meia-noite e respeita número de boxes", () => {
  const busy = [0, 1, 2].map(() => ({ start: localToDate("2026-12-01", 600, "-03:00"), end: localToDate("2026-12-01", 660, "-03:00"), professional_id: null }));
  const s = computeSlots({ ...base, openMin: 360, closeMin: 1440, capacity: 3, professionalIds: [], chosenProfessional: null, busy });
  assert.equal(s[0].time, 360);
  assert.equal(s.at(-1)!.time, 1380); // último começa 23h e termina meia-noite
  assert.ok(!s.some(x => x.time === 600)); // 10h lotado (3 boxes ocupados)
  assert.ok(!s.some(x => x.time === 570)); // 9h30 encostaria no 10h
  assert.equal(s.find(x => x.time === 540)!.free, 3);
});

test("barbearia: barbeiro escolhido ocupado some; 'qualquer um' acha outro", () => {
  const busy = [{ start: localToDate("2026-12-01", 600, "-03:00"), end: localToDate("2026-12-01", 645, "-03:00"), professional_id: "rafa" }];
  const common = { ...base, durationMin: 45, openMin: 540, closeMin: 1200, capacity: 1, professionalIds: ["rafa", "leo"], busy };
  assert.ok(!computeSlots({ ...common, chosenProfessional: "rafa" }).some(x => x.time === 600));
  const any = computeSlots({ ...common, chosenProfessional: null }).find(x => x.time === 600)!;
  assert.equal(any.professionalId, "leo");
});

test("domingo fechado e horários passados não aparecem", () => {
  assert.equal(computeSlots({ ...base, date: "2026-11-29", openMin: 540, closeMin: 1200, capacity: 1, professionalIds: [], chosenProfessional: null, busy: [] }).length, 0);
  const s = computeSlots({ ...base, date: "2026-11-30", openMin: 540, closeMin: 1200, capacity: 1, professionalIds: [], chosenProfessional: null, busy: [] });
  assert.ok(s[0].time >= 9 * 60 + 15); // agora = 9h local, com 15 min de antecedência
});

test("telefone no formato do WhatsApp", () => {
  assert.equal(toWhatsApp("(11) 98765-4321"), "5511987654321");
  assert.equal(toWhatsApp("+55 19 3456-7890"), "551934567890");
  assert.equal(toWhatsApp("123"), null);
});

test("preço por tamanho do carro e leva e traz", () => {
  const s = [{ id: "a", kind: "principal", name: "Completa", info: "", price: 70, cost: 14, duration_min: 70, image_url: null, video_url: null, tag: null }] as const;
  const q = quote([...s], { id: "suv", name: "SUV", ex: "", k: 1.35 }, 20);
  assert.equal(q.total, 95 + 20);
  assert.equal(q.duration, 70);
});

test("senha: scrypt e senha inicial do seed", () => {
  const h = hashPassword("segredo1");
  assert.ok(verifyPassword("segredo1", h));
  assert.ok(!verifyPassword("errada", h));
  const seed = "sha256:barbearia:" + createHash("sha256").update("barbearia" + "trocar123").digest("hex");
  assert.ok(verifyPassword("trocar123", seed));
});
