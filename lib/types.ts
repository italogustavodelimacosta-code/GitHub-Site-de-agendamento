export type Kind = "barbearia" | "lavarapido";
export type Size = { id: string; name: string; ex: string; k: number };
export type Clip = { src: string; poster?: string; cap: string };
export type BizConfig = { style?: string; layout?: string; pickupFee?: number; sizes?: Size[]; clips?: Clip[]; cliente?: boolean; aviso_email?: string };
export type Business = {
  id: string; slug: string; kind: Kind; name: string; address: string;
  open_min: number; close_min: number; step_min: number; capacity: number;
  closed_weekdays: number[]; tz_offset: string; owner_whatsapp: string; owner_password_hash: string;
  config: BizConfig; trailer_video: string | null; trailer_poster: string | null; gallery: string[];
};
export type PublicBusiness = Omit<Business, "owner_whatsapp" | "owner_password_hash">;
export type Professional = { id: string; name: string; info: string };
export type Service = {
  id: string; kind: "principal" | "extra"; name: string; info: string; price: number; cost: number;
  duration_min: number; image_url: string | null; video_url: string | null; tag: string | null;
};
export type Booking = {
  id: string; business_id: string; professional_id: string | null; client_name: string; client_phone: string;
  client_email: string; starts_at: string; ends_at: string; items: { name: string; price: number; cost: number }[];
  total: number; cost: number; vehicle_size: string | null; plate: string | null; pickup_address: string | null;
  status: "confirmado" | "concluido" | "cancelado" | "faltou"; reminder_sent_at: string | null; created_at: string;
};
