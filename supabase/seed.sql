-- Dados iniciais dos dois negócios. Rode depois do schema.sql.
-- Troque nomes, endereços, preços e custos pelos reais (ou edite depois no Supabase > Table Editor).
-- A senha inicial do painel dos dois é "trocar123". Troque assim que entrar.

with b as (
  insert into businesses (slug, kind, name, address, open_min, close_min, step_min, capacity, closed_weekdays, owner_whatsapp, owner_password_hash, trailer_video, trailer_poster, config)
  values ('barbearia', 'barbearia', 'Barbearia Corte Fino', 'Rua das Palmeiras, 120', 540, 1200, 30, 1, '{0}', '', '',
          '/media/trailer.mp4', '/media/trailer.jpg', '{"style":"noturno"}')
  returning id
), p as (
  insert into professionals (business_id, name, info, sort)
  select id, x.name, x.info, x.sort from b, (values ('Rafael','Degradê e navalhado',1),('Léo','Barba e tesoura',2),('Duda','Cortes clássicos',3)) as x(name, info, sort)
  returning 1
)
insert into services (business_id, kind, name, price, cost, duration_min, image_url, video_url, tag, sort)
select b.id, x.kind, x.name, x.price, x.cost, x.dur, x.img, x.vid, x.tag, x.sort from b, (values
  ('principal','Degradê com nuca em V',50,9,45,'/media/corte1.jpg',null,null,1),
  ('principal','Crop francês com degradê',50,9,45,'/media/corte2.jpg',null,null,2),
  ('principal','Taper texturizado',55,10,50,'/media/corte3.jpg',null,null,3),
  ('principal','Corte americano',50,9,45,'/media/corte4.jpg','/media/americano.mp4','Mais pedido',4),
  ('principal','Corte militar',35,6,30,'/media/corte5.jpg','/media/trailer.mp4',null,5),
  ('principal','Médio na tesoura',55,10,50,'/media/corte6.jpg',null,null,6),
  ('principal','Mullet moderno',55,10,50,'/media/corte7.jpg',null,null,7),
  ('principal','Taper com cachos',60,12,55,'/media/corte8.jpg',null,null,8),
  ('extra','Barba completa',35,7,30,null,null,null,9),
  ('extra','Pezinho e acabamento',20,3,15,null,null,null,10),
  ('extra','Sobrancelha',15,2,10,null,null,null,11)
) as x(kind, name, price, cost, dur, img, vid, tag, sort);

with b as (
  insert into businesses (slug, kind, name, address, open_min, close_min, step_min, capacity, closed_weekdays, owner_whatsapp, owner_password_hash, trailer_video, trailer_poster, gallery, config)
  values ('lavarapido', 'lavarapido', 'Lava-Rápido Gota Azul', 'Av. Brasil, 845', 360, 1440, 60, 3, '{}', '', '',
          '/media/lava_trailer.mp4', '/media/lava_trailer.jpg',
          array['/media/lava1.jpg','/media/lava2.jpg','/media/lava3.jpg','/media/lava4.jpg','/media/lava5.jpg','/media/lava6.jpg','/media/lava7.jpg','/media/lava8.jpg','/media/lava9.jpg','/media/lava10.jpg'],
          '{"style":"agua","pickupFee":20,"sizes":[{"id":"hatch","name":"Hatch","ex":"Onix, HB20, Gol","k":1},{"id":"sedan","name":"Sedã","ex":"Corolla, Virtus, Cruze","k":1.15},{"id":"suv","name":"SUV","ex":"Compass, Creta, T-Cross","k":1.35},{"id":"picape","name":"Picape","ex":"Hilux, Strada, Toro","k":1.5}],"clips":[{"src":"/media/lava_lavando.mp4","poster":"/media/lava_lavando.jpg","cap":"Carro sendo lavado"},{"src":"/media/lava_pronto.mp4","poster":"/media/lava_pronto.jpg","cap":"Carro pronto"}]}')
  returning id
)
insert into services (business_id, kind, name, info, price, cost, duration_min, image_url, tag, sort)
select b.id, x.kind, x.name, x.info, x.price, x.cost, x.dur, x.img, x.tag, x.sort from b, (values
  ('principal','Lavagem simples','Externa, rodas e secagem',40,8,40,'/media/lava2.jpg',null,1),
  ('principal','Lavagem completa','Simples + aspiração e painel',70,14,70,'/media/lava9.jpg','Mais pedido',2),
  ('principal','Detalhada','Completa + cera e pretinho nos pneus',120,28,120,'/media/lava3.jpg',null,3),
  ('extra','Cera de carnaúba','',30,8,20,null,null,4),
  ('extra','Higienização dos bancos','',90,20,90,null,null,5),
  ('extra','Lavagem do motor','',35,6,20,null,null,6),
  ('extra','Oxi-sanitização','',50,10,30,null,null,7)
) as x(kind, name, info, price, cost, dur, img, tag, sort);

-- Senha inicial do painel: "trocar123". O painel avisa para trocar no primeiro acesso.
update businesses set owner_password_hash = 'sha256:' || slug || ':' || encode(digest(slug || 'trocar123', 'sha256'), 'hex')
where owner_password_hash = '';
