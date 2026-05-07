import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

const APP_NAME = process.env.PUBLIC_APP_NAME || 'StarLucky';
const APP_BASE_URL = process.env.APP_BASE_URL || '';
const BOT_USERNAME = process.env.PUBLIC_TG_BOT_USERNAME || 'StarLucky_bot';
const CHANNEL_URL = process.env.PUBLIC_CHANNEL_URL || 'https://t.me/';
const SUPPORT_URL = process.env.PUBLIC_SUPPORT_URL || 'https://t.me/';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TON_API_BASE = (process.env.TON_API_BASE || 'https://tonapi.io').replace(/\/$/, '');
const TON_API_KEY = process.env.TON_API_KEY || '';
const NFT_SYNC_ENABLED = String(process.env.NFT_SYNC_ENABLED || 'true') === 'true';
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } }) : null;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use(express.static(path.join(__dirname,'public')));

function id(prefix='id'){return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;}
function tgUser(req){
  const raw = req.header('x-telegram-user') || '';
  try { return raw ? JSON.parse(Buffer.from(raw,'base64url').toString('utf8')) : null; } catch { return null; }
}
function safeName(u){ return [u?.first_name,u?.last_name].filter(Boolean).join(' ').trim() || u?.username || 'Игрок'; }
function admin(req,res,next){ if(!ADMIN_TOKEN || req.header('x-admin-token') !== ADMIN_TOKEN) return res.status(401).json({ok:false,error:'admin_token'}); next(); }
async function q(sql, params=[]){ if(!pool) throw new Error('DATABASE_URL is not set'); return pool.query(sql, params); }

async function migrate(){
  if(!pool) { console.warn('DATABASE_URL is not set. DB systems disabled.'); return; }
  await q(`
    create table if not exists users(
      telegram_id text primary key,
      display_name text not null default 'Игрок',
      username text,
      photo_url text,
      balance_stars bigint not null default 0 check(balance_stars >= 0),
      xp bigint not null default 0,
      level int not null default 1,
      wallet_address text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists ledger(
      id text primary key,
      telegram_id text not null references users(telegram_id) on delete cascade,
      delta_stars bigint not null,
      reason text not null,
      meta jsonb not null default '{}',
      created_at timestamptz not null default now()
    );
    create table if not exists tasks(
      id text primary key,
      title text not null,
      description text not null default '',
      reward_stars bigint not null default 0 check(reward_stars >= 0),
      image_url text,
      button_text text not null default 'Открыть',
      button_url text,
      active boolean not null default true,
      sort_order int not null default 0,
      created_at timestamptz not null default now()
    );
    create table if not exists task_claims(
      id text primary key,
      task_id text not null references tasks(id) on delete cascade,
      telegram_id text not null references users(telegram_id) on delete cascade,
      status text not null default 'pending',
      proof text,
      created_at timestamptz not null default now(),
      reviewed_at timestamptz,
      unique(task_id, telegram_id)
    );
    create table if not exists gifts(
      id text primary key,
      title text not null,
      description text not null default '',
      price_stars bigint not null check(price_stars >= 0),
      stock int not null default 0 check(stock >= 0),
      image_url text,
      animation_url text,
      background_css text,
      active boolean not null default true,
      created_at timestamptz not null default now()
    );
    create table if not exists inventory(
      id text primary key,
      telegram_id text not null references users(telegram_id) on delete cascade,
      source text not null,
      title text not null,
      description text,
      image_url text,
      animation_url text,
      background_css text,
      collection_name text,
      nft_address text,
      price_label text,
      price_value numeric,
      meta jsonb not null default '{}',
      created_at timestamptz not null default now(),
      unique(telegram_id, source, nft_address)
    );
    create table if not exists orders(
      id text primary key,
      telegram_id text not null references users(telegram_id) on delete cascade,
      gift_id text not null references gifts(id),
      price_stars bigint not null,
      status text not null default 'completed',
      created_at timestamptz not null default now()
    );
    create table if not exists live_drops(
      id text primary key,
      telegram_id text,
      display_name text not null default 'Игрок',
      type text not null,
      title text not null,
      subtitle text,
      image_url text,
      animation_url text,
      background_css text,
      price_label text,
      price_value numeric,
      source_id text,
      created_at timestamptz not null default now()
    );
  `);
}

async function upsertUser(user){
  const telegramId = String(user?.id || 'guest');
  const displayName = safeName(user);
  await q(`insert into users(telegram_id, display_name, username, photo_url)
           values($1,$2,$3,$4)
           on conflict(telegram_id) do update set display_name=excluded.display_name, username=excluded.username, photo_url=excluded.photo_url, updated_at=now()`,
    [telegramId, displayName, user?.username || null, user?.photo_url || null]);
  return telegramId;
}
async function getUserRow(telegramId){
  const r=await q('select * from users where telegram_id=$1',[telegramId]); return r.rows[0];
}
async function addLiveDrop({telegram_id, display_name, type, title, subtitle, image_url, animation_url, background_css, price_label, price_value, source_id}){
  await q(`insert into live_drops(id,telegram_id,display_name,type,title,subtitle,image_url,animation_url,background_css,price_label,price_value,source_id)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id('drop'), telegram_id, display_name || 'Игрок', type, title, subtitle || null, image_url || null, animation_url || null, background_css || null, price_label || null, price_value || null, source_id || null]);
}

function extractNftName(nft){ return nft?.metadata?.name || nft?.name || nft?.collection?.name || 'NFT'; }
function extractImage(nft){
  return nft?.previews?.find(p=>p.resolution==='500x500')?.url || nft?.previews?.[0]?.url || nft?.metadata?.image || nft?.metadata?.image_url || nft?.metadata?.content_url || null;
}
function extractAnimation(nft){ return nft?.metadata?.animation_url || nft?.metadata?.lottie || nft?.metadata?.video || null; }
function isGift(nft){
  const text = `${nft?.collection?.name||''} ${nft?.metadata?.name||''} ${nft?.metadata?.description||''}`.toLowerCase();
  return text.includes('telegram gift') || text.includes('collectible gift') || text.includes('gift');
}
function normalizePrice(nft){
  const sale = nft?.sale || nft?.metadata?.sale || null;
  const nano = sale?.price?.value || sale?.full_price || sale?.price;
  if(nano && !Number.isNaN(Number(nano))) {
    const ton = Number(nano) / 1e9;
    return { label: `${ton.toLocaleString('ru-RU',{maximumFractionDigits:2})} TON`, value: ton };
  }
  return { label: nft?.metadata?.price || null, value: null };
}
async function fetchTonNfts(address){
  const url = `${TON_API_BASE}/v2/accounts/${encodeURIComponent(address)}/nfts?limit=1000&offset=0&indirect_ownership=true`;
  const headers = TON_API_KEY ? { Authorization: `Bearer ${TON_API_KEY}` } : {};
  const resp = await fetch(url, { headers });
  if(!resp.ok) throw new Error(`TON API ${resp.status}`);
  const data = await resp.json();
  return data.nft_items || data.items || [];
}

app.get('/health',(req,res)=>res.json({ok:true,app:APP_NAME}));
app.get('/api/version',(req,res)=>res.json({ok:true,app:'StarLucky',version:'8.1.0-real-live-drops',time:new Date().toISOString()}));
app.get('/api/config',(req,res)=>res.json({appName:APP_NAME,baseUrl:APP_BASE_URL,botUsername:BOT_USERNAME,channelUrl:CHANNEL_URL,supportUrl:SUPPORT_URL,tonManifestUrl:`${APP_BASE_URL}/tonconnect-manifest.json`}));
app.get('/tonconnect-manifest.json',(req,res)=>res.json({url:APP_BASE_URL||'https://example.com',name:APP_NAME,iconUrl:`${APP_BASE_URL}/icon.png`}));

app.post('/api/session', async (req,res)=>{
  try{ const telegramId=await upsertUser(req.body?.user||{}); const user=await getUserRow(telegramId); res.json({ok:true,user}); }catch(e){ res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/me', async (req,res)=>{
  try{ const user=tgUser(req)||{id:'guest'}; const telegramId=await upsertUser(user); const row=await getUserRow(telegramId); const inv=await q('select * from inventory where telegram_id=$1 order by created_at desc limit 200',[telegramId]); res.json({ok:true,user:row,inventory:inv.rows}); }catch(e){ res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/live-drops', async (req,res)=>{
  try{ const limit=Math.min(80, Number(req.query.limit||30)); const r=await q('select * from live_drops order by created_at desc limit $1',[limit]); res.json({ok:true,drops:r.rows}); }catch(e){ res.status(500).json({ok:false,error:e.message}); }
});
app.get('/api/gifts', async(req,res)=>{ try{ const r=await q('select * from gifts where active=true order by created_at desc limit 100'); res.json({ok:true,gifts:r.rows}); }catch(e){ res.status(500).json({ok:false,error:e.message}); } });
app.post('/api/gifts/:giftId/buy', async(req,res)=>{
  const client = await pool.connect();
  try{
    const user=tgUser(req)||req.body?.user||{id:'guest'}; const telegramId=await upsertUser(user);
    await client.query('begin');
    const u=(await client.query('select * from users where telegram_id=$1 for update',[telegramId])).rows[0];
    const g=(await client.query('select * from gifts where id=$1 and active=true for update',[req.params.giftId])).rows[0];
    if(!g) throw new Error('gift_not_found');
    if(g.stock <= 0) throw new Error('out_of_stock');
    if(Number(u.balance_stars) < Number(g.price_stars)) throw new Error('not_enough_balance');
    await client.query('update users set balance_stars=balance_stars-$1, updated_at=now() where telegram_id=$2',[g.price_stars, telegramId]);
    await client.query('update gifts set stock=stock-1 where id=$1',[g.id]);
    const orderId=id('order'); const invId=id('inv');
    await client.query('insert into orders(id,telegram_id,gift_id,price_stars) values($1,$2,$3,$4)',[orderId,telegramId,g.id,g.price_stars]);
    await client.query(`insert into inventory(id,telegram_id,source,title,description,image_url,animation_url,background_css,price_label,price_value,meta)
      values($1,$2,'gift',$3,$4,$5,$6,$7,$8,$9,$10)`,[invId,telegramId,g.title,g.description,g.image_url,g.animation_url,g.background_css,`${g.price_stars} ★`,g.price_stars,JSON.stringify({gift_id:g.id,order_id:orderId})]);
    await client.query(`insert into live_drops(id,telegram_id,display_name,type,title,subtitle,image_url,animation_url,background_css,price_label,price_value,source_id)
      values($1,$2,$3,'gift',$4,'Подарок',$5,$6,$7,$8,$9,$10)`,[id('drop'),telegramId,u.display_name,g.title,g.image_url,g.animation_url,g.background_css,`${g.price_stars} ★`,g.price_stars,invId]);
    await client.query('commit');
    res.json({ok:true,orderId,inventoryId:invId});
  }catch(e){ await client.query('rollback').catch(()=>{}); res.status(400).json({ok:false,error:e.message}); }
  finally{ client.release(); }
});

app.post('/api/ton/sync', async(req,res)=>{
  try{
    if(!NFT_SYNC_ENABLED) return res.status(403).json({ok:false,error:'nft_sync_disabled'});
    const user=tgUser(req)||req.body?.user||{id:'guest'}; const telegramId=await upsertUser(user);
    const wallet=String(req.body?.address||'').trim(); if(!/^(UQ|EQ|0:)/.test(wallet)) return res.status(400).json({ok:false,error:'bad_wallet'});
    await q('update users set wallet_address=$1, updated_at=now() where telegram_id=$2',[wallet,telegramId]);
    const nfts = await fetchTonNfts(wallet);
    const saved=[];
    const display = (await getUserRow(telegramId))?.display_name || safeName(user);
    for(const nft of nfts){
      const nftAddress = nft?.address || nft?.account?.address || nft?.raw_address;
      if(!nftAddress) continue;
      const title = extractNftName(nft);
      const image = extractImage(nft);
      const animation = extractAnimation(nft);
      const price = normalizePrice(nft);
      const type = isGift(nft) ? 'telegram_gift' : 'nft';
      const collection = nft?.collection?.name || null;
      const bg = type === 'telegram_gift' ? 'linear-gradient(135deg,rgba(255,196,90,.18),rgba(168,85,247,.12))' : 'linear-gradient(135deg,rgba(255,255,255,.07),rgba(255,196,90,.06))';
      const invId = id('inv');
      const insert = await q(`insert into inventory(id,telegram_id,source,title,description,image_url,animation_url,background_css,collection_name,nft_address,price_label,price_value,meta)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        on conflict(telegram_id,source,nft_address) do update set title=excluded.title,image_url=excluded.image_url,animation_url=excluded.animation_url,collection_name=excluded.collection_name,price_label=excluded.price_label,price_value=excluded.price_value,meta=excluded.meta
        returning id`,[invId,telegramId,type,title,nft?.metadata?.description||null,image,animation,bg,collection,nftAddress,price.label,price.value,JSON.stringify(nft)]);
      const sourceId = insert.rows[0]?.id || invId;
      saved.push({title,image,animation,collection,nftAddress,price,type});
      await addLiveDrop({telegram_id:telegramId,display_name:display,type,title,subtitle:collection,image_url:image,animation_url:animation,background_css:bg,price_label:price.label || 'нет цены',price_value:price.value,source_id:sourceId});
    }
    res.json({ok:true,count:saved.length,items:saved});
  }catch(e){ res.status(500).json({ok:false,error:e.message}); }
});

app.get('/api/tasks', async(req,res)=>{ try{ const r=await q('select * from tasks where active=true order by sort_order asc, created_at desc'); res.json({ok:true,tasks:r.rows}); }catch(e){ res.status(500).json({ok:false,error:e.message}); } });
app.post('/api/tasks/:taskId/claim', async(req,res)=>{ try{ const user=tgUser(req)||req.body?.user||{id:'guest'}; const telegramId=await upsertUser(user); await q('insert into task_claims(id,task_id,telegram_id,proof) values($1,$2,$3,$4) on conflict(task_id,telegram_id) do nothing',[id('claim'),req.params.taskId,telegramId,req.body?.proof||null]); res.json({ok:true,status:'pending'}); }catch(e){ res.status(400).json({ok:false,error:e.message}); } });

app.get('/api/admin/gifts', admin, async(req,res)=>{ const r=await q('select * from gifts order by created_at desc'); res.json({ok:true,gifts:r.rows}); });
app.post('/api/admin/gifts', admin, async(req,res)=>{ const b=req.body||{}; const giftId=b.id||id('gift'); await q(`insert into gifts(id,title,description,price_stars,stock,image_url,animation_url,background_css,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9)
  on conflict(id) do update set title=excluded.title,description=excluded.description,price_stars=excluded.price_stars,stock=excluded.stock,image_url=excluded.image_url,animation_url=excluded.animation_url,background_css=excluded.background_css,active=excluded.active`,[giftId,b.title,b.description||'',Number(b.price_stars||0),Number(b.stock||0),b.image_url||null,b.animation_url||null,b.background_css||null,b.active!==false]); res.json({ok:true,id:giftId}); });
app.get('/api/admin/tasks', admin, async(req,res)=>{ const r=await q('select * from tasks order by sort_order asc, created_at desc'); res.json({ok:true,tasks:r.rows}); });
app.post('/api/admin/tasks', admin, async(req,res)=>{ const b=req.body||{}; const taskId=b.id||id('task'); await q(`insert into tasks(id,title,description,reward_stars,image_url,button_text,button_url,active,sort_order) values($1,$2,$3,$4,$5,$6,$7,$8,$9)
  on conflict(id) do update set title=excluded.title,description=excluded.description,reward_stars=excluded.reward_stars,image_url=excluded.image_url,button_text=excluded.button_text,button_url=excluded.button_url,active=excluded.active,sort_order=excluded.sort_order`,[taskId,b.title,b.description||'',Number(b.reward_stars||0),b.image_url||null,b.button_text||'Открыть',b.button_url||null,b.active!==false,Number(b.sort_order||0)]); res.json({ok:true,id:taskId}); });
app.get('/api/admin/claims', admin, async(req,res)=>{ const r=await q(`select c.*,t.title,t.reward_stars,u.display_name from task_claims c join tasks t on t.id=c.task_id join users u on u.telegram_id=c.telegram_id order by c.created_at desc limit 200`); res.json({ok:true,claims:r.rows}); });
app.post('/api/admin/claims/:claimId/approve', admin, async(req,res)=>{
 const client=await pool.connect(); try{ await client.query('begin'); const claim=(await client.query(`select c.*,t.reward_stars,t.title,u.display_name from task_claims c join tasks t on t.id=c.task_id join users u on u.telegram_id=c.telegram_id where c.id=$1 and c.status='pending' for update`,[req.params.claimId])).rows[0]; if(!claim) throw new Error('claim_not_found'); await client.query('update task_claims set status=$1,reviewed_at=now() where id=$2',['approved',claim.id]); await client.query('update users set balance_stars=balance_stars+$1,xp=xp+$1/10,level=greatest(1,floor((xp+$1/10)/1000)+1),updated_at=now() where telegram_id=$2',[claim.reward_stars,claim.telegram_id]); await client.query('insert into ledger(id,telegram_id,delta_stars,reason,meta) values($1,$2,$3,$4,$5)',[id('led'),claim.telegram_id,claim.reward_stars,`Задание: ${claim.title}`,JSON.stringify({claim_id:claim.id})]); await client.query('commit'); res.json({ok:true}); } catch(e){ await client.query('rollback').catch(()=>{}); res.status(400).json({ok:false,error:e.message}); } finally{ client.release(); }
});

async function sendTelegramMessage(chatId){ if(!BOT_TOKEN) return; const text=`Добро пожаловать в ${APP_NAME}\n\nОткрой mini app, чтобы смотреть подарки, NFT и задания.`; const reply_markup={inline_keyboard:[[{text:'Канал',url:CHANNEL_URL},{text:'Поддержка',url:SUPPORT_URL}],[{text:'Играть',web_app:{url:APP_BASE_URL}}]]}; await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup})}); }
app.post('/api/telegram/webhook', async(req,res)=>{ try{ if(WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token')!==WEBHOOK_SECRET) return res.status(403).json({ok:false}); const msg=req.body?.message; if(msg?.chat?.id && String(msg?.text||'').startsWith('/start')) await sendTelegramMessage(msg.chat.id); res.json({ok:true}); }catch(e){ console.error(e); res.status(500).json({ok:false}); } });

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

migrate().then(()=>app.listen(PORT,()=>console.log(`${APP_NAME} v8.1 on ${PORT}`))).catch(e=>{console.error(e); process.exit(1);});
