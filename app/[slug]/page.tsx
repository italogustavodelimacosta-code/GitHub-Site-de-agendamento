import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBusiness, getCatalog } from "@/lib/db";
import { dateToLocal } from "@/lib/time";
import BookingFlow from "@/components/BookingFlow";
import type { PublicBusiness } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const b = await getBusiness(params.slug);
  return { title: b ? `Agendar · ${b.name}` : "Agendamento" };
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const biz = await getBusiness(params.slug);
  if (!biz) notFound();
  const { services, professionals } = await getCatalog(biz.id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { owner_whatsapp, owner_password_hash, ...pub } = biz;
  const today = dateToLocal(new Date(), biz.tz_offset).date;
  return (
    <div data-style={biz.config.style || undefined} style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <BookingFlow biz={pub as PublicBusiness} services={services} professionals={professionals} today={today} />
    </div>
  );
}
