import Link from "next/link";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Só mostra os negócios de demonstração. Cada cliente recebe o próprio link e não aparece aqui.
  const { data } = await db().from("businesses").select("slug,name,address").or("config->>cliente.is.null,config->>cliente.neq.true").order("name");
  return (
    <div className="wrap">
      <h1>Agendamento online</h1>
      <p className="hint">Escolha onde você quer agendar.</p>
      <div className="list">
        {(data || []).map(b => (
          <Link key={b.slug} href={`/${b.slug}`} className="opt" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="grow"><b>{b.name}</b><small>{b.address}</small></div><span className="price">Agendar →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
