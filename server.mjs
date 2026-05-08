import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { Address } from '@ton/core';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const APP = process.env.PUBLIC_APP_NAME || 'StarLucky';
const BASE = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
const BOT = process.env.PUBLIC_TG_BOT_USERNAME || 'StarLucky_bot';
const CHANNEL = process.env.PUBLIC_CHANNEL_URL || 'https://t.me/';
const SUPPORT = process.env.PUBLIC_SUPPORT_URL || 'https://t.me/';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TON_API_BASE = process.env.TON_API_BASE || 'https://tonapi.io';
const TON_API_KEY = process.env.TON_API_KEY || '';
const NFT_SYNC_ENABLED = process.env.NFT_SYNC_ENABLED !== 'false';

const pool = process.env.DATABASE_URL ? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : undefined
}) : null;

app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));
app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
app.use(express.static(path.join(__dirname, 'public')));

async function q(text, params=[]) { if (!pool) throw new Error('DATABASE_URL is missing'); return pool.query(text, params); }

async function initDb(){
  if(!pool) return;
  await q(`
  create table if not exists users(
    id bigserial primary key,
    tg_id text unique not null,
    first_name text default '', last_name text default '', username text default '', photo_url text default '',
    balance bigint not null default 0, xp bigint not null default 0, created_at timestamptz default now(), updated_at timestamptz default now()
  );
  create table if not exists ledger(
    id bigserial primary key, user_id bigint references users(id), amount bigint not null, kind text not null, ref text, meta jsonb default '{}'::jsonb, created_at timestamptz default now()
  );
  create table if not exists gifts(
    id bigserial primary key, title text not null, price bigint not null default 0, stock int not null default 0,
    image_url text default '', animation_url text default '', bg_css text default '', description text default '', is_active boolean default true, created_at timestamptz default now()
  );
  create table if not exists cases(
    id bigserial primary key, title text not null, price bigint not null default 0, stock int not null default 0,
    image_url text default '', bg_css text default '', description text default '', is_active boolean default true, created_at timestamptz default now()
  );
  create table if not exists case_rewards(
    id bigserial primary key, case_id bigint references cases(id) on delete cascade, title text not null, weight int not null default 1,
    value_stars bigint default 0, image_url text default '', animation_url text default '', bg_css text default '', stock int default -1, created_at timestamptz default now()
  );
  create table if not exists inventory(
    id bigserial primary key, user_id bigint references users(id), source text not null, source_id text, title text not null,
    price_label text default '', image_url text default '', animation_url text default '', bg_css text default '', meta jsonb default '{}'::jsonb, created_at timestamptz default now()
  );
  create table if not exists tasks(
    id bigserial primary key, title text not null, description text default '', reward bigint not null default 0, image_url text default '', button_text text default 'Открыть', button_url text default '', is_active boolean default true, created_at timestamptz default now()
  );
  create table if not exists task_submissions(
    id bigserial primary key, user_id bigint references users(id), task_id bigint references tasks(id), status text default 'pending', created_at timestamptz default now(), decided_at timestamptz
  );
  create table if not exists live_drops(
    id bigserial primary key, user_id bigint references users(id), title text not null, price_label text default '', image_url text default '', animation_url text default '', bg_css text default '', source text default 'gift', created_at timestamptz default now()
  );
  create table if not exists wallets(
    id bigserial primary key, user_id bigint references users(id), address text not null, created_at timestamptz default now(), unique(user_id,address)
  );
  create table if not exists star_payments(
    id bigserial primary key, user_id bigint references users(id), stars_amount bigint not null, bonus_amount bigint not null default 0, total_amount bigint not null,
    payload text unique not null, status text not null default 'created', invoice_link text default '', telegram_payment_charge_id text default '', created_at timestamptz default now(), paid_at timestamptz
  );
  create table if not exists ton_payments(
    id bigserial primary key, user_id bigint references users(id), stars_amount bigint not null, bonus_amount bigint not null default 0, ton_amount text not null, wallet_address text default '', receiver_address text default '', memo text unique not null, status text not null default 'created', created_at timestamptz default now(), paid_at timestamptz
  );
  create table if not exists audit_log(
    id bigserial primary key, actor text default '', action text not null, target text default '', meta jsonb default '{}'::jsonb, created_at timestamptz default now()
  );
  create index if not exists idx_ledger_user_created on ledger(user_id, created_at desc);
  create index if not exists idx_inventory_user_created on inventory(user_id, created_at desc);
  create index if not exists idx_live_drops_created on live_drops(created_at desc);
  create index if not exists idx_star_payments_user_created on star_payments(user_id, created_at desc);
  create index if not exists idx_ton_payments_user_created on ton_payments(user_id, created_at desc);
  create index if not exists idx_task_submissions_user_task on task_submissions(user_id, task_id);
  create index if not exists idx_users_updated on users(updated_at desc);
  delete from task_submissions a using task_submissions b where a.id > b.id and a.user_id=b.user_id and a.task_id=b.task_id;
  create unique index if not exists uniq_task_submission_user_task on task_submissions(user_id, task_id);
  `);
}
initDb().catch(e=>console.error('DB init failed', e));

function webappUser(initData){
  if(!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if(!hash) return null;
  params.delete('hash');
  const dataCheckString = [...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('\n');
  if(BOT_TOKEN){
    const secret = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    if(!crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  }
  try { return JSON.parse(params.get('user') || '{}'); } catch { return null; }
}

async function requireUser(req,res,next){
  try{
    const initData = req.header('x-telegram-init-data') || req.body?.initData || req.query?.initData || '';
    let tu = webappUser(initData);
    if(!tu && process.env.NODE_ENV !== 'production') tu = { id:'dev', first_name:'Dev', last_name:'User', username:'dev', photo_url:'' };
    if(!tu?.id) return res.status(401).json({ok:false,error:'telegram_auth_required', hint:'Open the app from Telegram Mini App and check TELEGRAM_BOT_TOKEN matches this bot'});
    const user = await upsertTelegramUser(tu);
    req.user = user; next();
  }catch(e){ console.error(e); res.status(500).json({ok:false,error:'user_load_failed'}); }
}
function admin(req,res,next){ if(!ADMIN_TOKEN || req.header('x-admin-token') !== ADMIN_TOKEN) return res.status(403).json({ok:false,error:'admin_forbidden'}); next(); }
function levelFromXp(xp){ return Math.max(1, Math.floor(Number(xp||0)/1000)+1); }

async function upsertTelegramUser(tu){
  if(!tu?.id || !pool) return null;
  const tgId = String(tu.id);
  const r = await q(`insert into users(tg_id,first_name,last_name,username,photo_url,updated_at)
    values($1,$2,$3,$4,$5,now())
    on conflict(tg_id) do update set
      first_name=coalesce(nullif(excluded.first_name,''), users.first_name),
      last_name=coalesce(nullif(excluded.last_name,''), users.last_name),
      username=coalesce(nullif(excluded.username,''), users.username),
      photo_url=coalesce(nullif(excluded.photo_url,''), users.photo_url),
      updated_at=now()
    returning *`, [tgId, tu.first_name||'', tu.last_name||'', tu.username||'', tu.photo_url||'']);
  return r.rows[0];
}
async function addDrop(client,userId,item){ await client.query(`insert into live_drops(user_id,title,price_label,image_url,animation_url,bg_css,source) values($1,$2,$3,$4,$5,$6,$7)`, [userId,item.title,item.price_label||'',item.image_url||'',item.animation_url||'',item.bg_css||'',item.source||'gift']); }

app.get('/health', async (req,res)=>{ let db=false; try{ if(pool){await q('select 1'); db=true;} }catch{} res.json({ok:true, app:APP, db}); });
app.get('/api/version',(req,res)=>res.json({ok:true, app:'StarLucky', version:'10.2.0-wallet-stars-fixed'}));
app.get('/api/config',(req,res)=>res.json({appName:APP, baseUrl:BASE, botUsername:BOT, channelUrl:CHANNEL, supportUrl:SUPPORT, tonReceiverWallet:process.env.PUBLIC_TON_RECEIVER_WALLET||'', tonManifestUrl:`${BASE || ''}/tonconnect-manifest.json`}));
app.post('/api/auth/check', async (req,res)=>{ const u = webappUser(req.body?.initData||''); res.json({ok:!!u, hasInitData:!!req.body?.initData, user:u?{id:u.id, first_name:u.first_name||'', last_name:u.last_name||'', username:u.username||'', photo_url:!!u.photo_url}:null}); });
app.get('/tonconnect-manifest.json',(req,res)=>res.json({url:BASE || `https://${req.get('host')}`, name:APP, iconUrl:`${BASE || `https://${req.get('host')}`}/icon.png`}));
app.post('/api/ton/normalize', requireUser, async (req,res)=>{ const address = normalizeTonAddress(req.body?.address); if(!address) return res.status(400).json({ok:false,error:'bad_ton_address'}); res.json({ok:true,address}); });


const STAR_PACKS = [30,100,200,500,1000,2500,5000];
function bonusForStars(amount, kind='stars'){
  if(kind==='ton'){
    if(amount>=5000) return 500;
    if(amount>=2500) return 125;
    if(amount>=1000) return 100;
    if(amount>=500) return 50;
    if(amount>=200) return 20;
    if(amount>=100) return 10;
    if(amount>=30) return 3;
  }
  if(kind==='send'){
    if(amount>=5000) return 500;
    if(amount>=2500) return 125;
    if(amount>=1000) return 50;
    if(amount>=500) return 25;
    if(amount>=200) return 10;
    if(amount>=100) return 5;
    if(amount>=30) return 1;
  }
  return 0;
}

function normalizeTonAddress(address){
  const raw = String(address||'').trim();
  if(!raw) return '';
  try { return Address.parse(raw).toString({ urlSafe:true, bounceable:false }); }
  catch { return ''; }
}
function isTonAddress(address){ return !!normalizeTonAddress(address); }

function tonEstimate(amount){ return (amount / Number(process.env.STARS_PER_TON || 173.5)).toFixed(2); }
app.get('/api/pay/packs', requireUser, async (req,res)=>{
  res.json({ok:true, packs: STAR_PACKS.map(amount=>({amount, ton:tonEstimate(amount), tonBonus:bonusForStars(amount,'ton'), sendBonus:bonusForStars(amount,'send')}))});
});
app.post('/api/pay/stars/create', requireUser, async (req,res)=>{
  const amount = Number(req.body.amount);
  if(!STAR_PACKS.includes(amount)) return res.status(400).json({ok:false,error:'bad_amount'});
  if(!BOT_TOKEN) return res.status(500).json({ok:false,error:'TELEGRAM_BOT_TOKEN_missing'});
  const payload = `stars:${req.user.id}:${amount}:${crypto.randomBytes(8).toString('hex')}`;
  const title = `${amount} Stars`;
  const description = `Пополнение баланса StarLucky на ${amount} звезд`;
  const body = {title, description, payload, provider_token:'', currency:'XTR', prices:[{label:title, amount}]};
  const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const data = await tgResp.json().catch(()=>({ok:false,description:'bad_json'}));
  if(!data.ok) return res.status(502).json({ok:false,error:data.description||'invoice_failed'});
  await q(`insert into star_payments(user_id,stars_amount,bonus_amount,total_amount,payload,invoice_link,status) values($1,$2,0,$2,$3,$4,'created')`, [req.user.id, amount, payload, data.result]);
  res.json({ok:true, invoiceLink:data.result, payload, amount});
});
app.post('/api/pay/ton/create', requireUser, async (req,res)=>{
  const amount = Number(req.body.amount);
  const wallet = normalizeTonAddress(req.body.wallet);
  if(!STAR_PACKS.includes(amount)) return res.status(400).json({ok:false,error:'bad_amount'});
  if(!wallet) return res.status(400).json({ok:false,error:'bad_ton_address'});
  const receiver = process.env.PUBLIC_TON_RECEIVER_WALLET || '';
  if(!receiver) return res.status(500).json({ok:false,error:'receiver_wallet_missing'});
  const bonus = bonusForStars(amount,'ton');
  const ton = tonEstimate(amount);
  const memo = `SL-${req.user.id}-${amount}-${crypto.randomBytes(4).toString('hex')}`;
  await q(`insert into ton_payments(user_id,stars_amount,bonus_amount,ton_amount,wallet_address,receiver_address,memo,status) values($1,$2,$3,$4,$5,$6,$7,'created')`, [req.user.id,amount,bonus,ton,wallet,receiver,memo]);
  res.json({ok:true, amount, bonus, total:amount+bonus, ton, receiver, memo});
});

app.get('/api/me', requireUser, async (req,res)=>{
  const inv = await q('select count(*)::int c from inventory where user_id=$1',[req.user.id]);
  res.json({ok:true,user:{id:req.user.id, name:`${req.user.first_name||''} ${req.user.last_name||''}`.trim() || req.user.username || 'Игрок', username:req.user.username, photo_url:req.user.photo_url, balance:Number(req.user.balance), xp:Number(req.user.xp), level:levelFromXp(req.user.xp), inventory_count:inv.rows[0].c}});
});
app.get('/api/catalog', requireUser, async (req,res)=>{
  const [gifts,cases,tasks,drops] = await Promise.all([
    q('select * from gifts where is_active=true order by id desc limit 60'),
    q('select * from cases where is_active=true order by id desc limit 60'),
    q('select t.*, coalesce(s.status, null) submission_status from tasks t left join task_submissions s on s.task_id=t.id and s.user_id=$1 where t.is_active=true order by t.id desc limit 80',[req.user.id]),
    q(`select d.*, coalesce(u.first_name,'') first_name, coalesce(u.last_name,'') last_name from live_drops d left join users u on u.id=d.user_id order by d.id desc limit 30`)
  ]);
  res.json({ok:true,gifts:gifts.rows,cases:cases.rows,tasks:tasks.rows,drops:drops.rows});
});
app.get('/api/inventory', requireUser, async (req,res)=>{
  const r=await q('select * from inventory where user_id=$1 order by id desc limit 200',[req.user.id]);
  res.json({ok:true,items:r.rows});
});
app.post('/api/wallet/connect', requireUser, async (req,res)=>{
  const address = normalizeTonAddress(req.body.address);
  if(!address) return res.status(400).json({ok:false,error:'bad_ton_address'});
  await q('insert into wallets(user_id,address) values($1,$2) on conflict do nothing',[req.user.id,address]);
  res.json({ok:true,address});
});
app.post('/api/ton/sync', requireUser, async (req,res)=>{
  if(!NFT_SYNC_ENABLED) return res.status(400).json({ok:false,error:'nft_sync_disabled'});
  const address = normalizeTonAddress(req.body.address);
  if(!address) return res.status(400).json({ok:false,error:'bad_ton_address'});
  const url = `${TON_API_BASE.replace(/\/$/,'')}/v2/accounts/${encodeURIComponent(address)}/nfts?limit=1000&offset=0`;
  const headers = TON_API_KEY ? { Authorization: `Bearer ${TON_API_KEY}` } : {};
  const resp = await fetch(url,{headers});
  if(!resp.ok) return res.status(502).json({ok:false,error:'tonapi_failed',status:resp.status});
  const data = await resp.json();
  const items = data.nft_items || data.items || [];
  const client = await pool.connect();
  try{
    await client.query('begin');
    let count=0;
    for(const nft of items){
      const title = nft.metadata?.name || nft.collection?.name || nft.address || 'TON NFT';
      const image = nft.previews?.find?.(p=>p.resolution==='500x500')?.url || nft.metadata?.image || nft.metadata?.image_data || '';
      const anim = nft.metadata?.animation_url || '';
      const sourceId = nft.address || nft.index || title;
      const price = nft.sale?.price?.value ? `${Math.round(Number(nft.sale.price.value)/1e9)} TON` : '';
      const ins = await client.query(`insert into inventory(user_id,source,source_id,title,price_label,image_url,animation_url,bg_css,meta)
        values($1,'ton_nft',$2,$3,$4,$5,$6,$7,$8)
        on conflict do nothing returning id`, [req.user.id,String(sourceId),title,price,image,anim,'linear-gradient(135deg,#20222a,#111)',JSON.stringify(nft)]);
      if(ins.rowCount){ count++; await addDrop(client,req.user.id,{title,price_label:price,image_url:image,animation_url:anim,bg_css:'linear-gradient(135deg,#222,#111)',source:'ton_nft'}); }
    }
    await client.query('commit');
    res.json({ok:true,synced:count,total:items.length});
  }catch(e){ await client.query('rollback'); throw e; } finally { client.release(); }
});
app.post('/api/case/open', requireUser, async (req,res)=>{
  const caseId = Number(req.body.caseId);
  const client = await pool.connect();
  try{
    await client.query('begin');
    const u=(await client.query('select * from users where id=$1 for update',[req.user.id])).rows[0];
    const c=(await client.query('select * from cases where id=$1 and is_active=true for update',[caseId])).rows[0];
    if(!c) throw Object.assign(new Error('case_not_found'),{status:404});
    if(c.stock===0) throw Object.assign(new Error('case_sold_out'),{status:400});
    if(Number(u.balance)<Number(c.price)) throw Object.assign(new Error('not_enough_balance'),{status:400});
    const rewards=(await client.query('select * from case_rewards where case_id=$1 and (stock<>0) order by id',[caseId])).rows;
    if(!rewards.length) throw Object.assign(new Error('case_has_no_rewards'),{status:400});
    const total=rewards.reduce((s,r)=>s+Number(r.weight),0); let roll=Math.random()*total; let reward=rewards[0];
    for(const r of rewards){ roll-=Number(r.weight); if(roll<=0){reward=r;break;} }
    await client.query('update users set balance=balance-$1,xp=xp+10 where id=$2',[c.price,req.user.id]);
    await client.query('insert into ledger(user_id,amount,kind,ref,meta) values($1,$2,$3,$4,$5)',[req.user.id,-Number(c.price),'case_open',String(c.id),JSON.stringify({case:c.title,reward:reward.title})]);
    if(c.stock>0) await client.query('update cases set stock=stock-1 where id=$1',[c.id]);
    if(reward.stock>0) await client.query('update case_rewards set stock=stock-1 where id=$1',[reward.id]);
    const inv=(await client.query(`insert into inventory(user_id,source,source_id,title,price_label,image_url,animation_url,bg_css,meta) values($1,'case_reward',$2,$3,$4,$5,$6,$7,$8) returning *`, [req.user.id,String(reward.id),reward.title,reward.value_stars?`${reward.value_stars} ★`:'',reward.image_url,reward.animation_url,reward.bg_css,JSON.stringify({case_id:c.id})])).rows[0];
    await addDrop(client,req.user.id,{...inv,source:'case'});
    await client.query('commit');
    const fresh=(await q('select balance,xp from users where id=$1',[req.user.id])).rows[0];
    res.json({ok:true,item:inv,balance:Number(fresh.balance),xp:Number(fresh.xp),level:levelFromXp(fresh.xp)});
  }catch(e){ await client.query('rollback'); res.status(e.status||500).json({ok:false,error:e.message}); } finally { client.release(); }
});
app.post('/api/task/submit', requireUser, async (req,res)=>{
  const taskId=Number(req.body.taskId);
  const task=(await q('select * from tasks where id=$1 and is_active=true',[taskId])).rows[0];
  if(!task) return res.status(404).json({ok:false,error:'task_not_found'});
  await q(`insert into task_submissions(user_id,task_id,status) values($1,$2,'pending') on conflict (user_id,task_id) do nothing`,[req.user.id,taskId]).catch(()=>{});
  res.json({ok:true,status:'pending'});
});

// Admin API
app.get('/api/admin/all', admin, async(req,res)=>{
  const [users,gifts,cases,tasks,drops,stats]=await Promise.all([
    q('select id,tg_id,first_name,last_name,username,balance,xp,updated_at from users order by id desc limit 500'),
    q('select * from gifts order by id desc'),
    q('select * from cases order by id desc'),
    q('select * from tasks order by id desc'),
    q('select * from live_drops order by id desc limit 100'),
    q(`select (select count(*) from users)::int users, (select count(*) from ledger)::int ledger, (select coalesce(sum(balance),0) from users)::bigint total_balance, (select count(*) from inventory)::int inventory`)
  ]);
  res.json({ok:true,users:users.rows,gifts:gifts.rows,cases:cases.rows,tasks:tasks.rows,drops:drops.rows,stats:stats.rows[0]});
});
app.post('/api/admin/gift', admin, async(req,res)=>{const b=req.body; const r=await q('insert into gifts(title,price,stock,image_url,animation_url,bg_css,description,is_active) values($1,$2,$3,$4,$5,$6,$7,true) returning *',[b.title,b.price||0,b.stock||0,b.image_url||'',b.animation_url||'',b.bg_css||'',b.description||'']); res.json({ok:true,gift:r.rows[0]});});
app.post('/api/admin/case', admin, async(req,res)=>{const b=req.body; const r=await q('insert into cases(title,price,stock,image_url,bg_css,description,is_active) values($1,$2,$3,$4,$5,$6,true) returning *',[b.title,b.price||0,b.stock||0,b.image_url||'',b.bg_css||'',b.description||'']); res.json({ok:true,case:r.rows[0]});});
app.post('/api/admin/case-reward', admin, async(req,res)=>{const b=req.body; const r=await q('insert into case_rewards(case_id,title,weight,value_stars,image_url,animation_url,bg_css,stock) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[b.case_id,b.title,b.weight||1,b.value_stars||0,b.image_url||'',b.animation_url||'',b.bg_css||'',b.stock??-1]); res.json({ok:true,reward:r.rows[0]});});
app.post('/api/admin/task', admin, async(req,res)=>{const b=req.body; const r=await q('insert into tasks(title,description,reward,image_url,button_text,button_url,is_active) values($1,$2,$3,$4,$5,$6,true) returning *',[b.title,b.description||'',b.reward||0,b.image_url||'',b.button_text||'Открыть',b.button_url||'']); res.json({ok:true,task:r.rows[0]});});
app.post('/api/admin/credit', admin, async(req,res)=>{const b=req.body; const userId=Number(b.user_id); const amount=Number(b.amount); const client=await pool.connect(); try{await client.query('begin'); await client.query('update users set balance=balance+$1 where id=$2',[amount,userId]); await client.query('insert into ledger(user_id,amount,kind,ref,meta) values($1,$2,$3,$4,$5)',[userId,amount,'admin_credit','admin',JSON.stringify({note:b.note||''})]); await client.query('commit'); res.json({ok:true});}catch(e){await client.query('rollback'); throw e;}finally{client.release();}});
app.post('/api/admin/task/approve', admin, async(req,res)=>{const id=Number(req.body.submission_id); const client=await pool.connect(); try{await client.query('begin'); const sub=(await client.query(`select s.*,t.reward from task_submissions s join tasks t on t.id=s.task_id where s.id=$1 and s.status='pending' for update`,[id])).rows[0]; if(!sub) throw Object.assign(new Error('submission_not_found'),{status:404}); await client.query(`update task_submissions set status='approved',decided_at=now() where id=$1`,[id]); await client.query('update users set balance=balance+$1,xp=xp+20 where id=$2',[sub.reward,sub.user_id]); await client.query('insert into ledger(user_id,amount,kind,ref) values($1,$2,$3,$4)',[sub.user_id,sub.reward,'task_reward',String(sub.task_id)]); await client.query('commit'); res.json({ok:true});}catch(e){await client.query('rollback'); res.status(e.status||500).json({ok:false,error:e.message});}finally{client.release();}});

async function sendStart(chatId){ if(!BOT_TOKEN) return; const play = BASE || ''; const text=`Добро пожаловать в ${APP}\n\nОткрывай mini app, участвуй в событиях, собирай подарки и управляй инвентарём.`; const reply_markup={inline_keyboard:[[{text:'Канал',url:CHANNEL},{text:'Поддержка',url:SUPPORT}],[{text:'Играть',web_app:{url:play}}]]}; await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:chatId,text,reply_markup})}); }

app.post('/api/telegram/webhook', async(req,res)=>{ try{
  if(WEBHOOK_SECRET && req.header('x-telegram-bot-api-secret-token')!==WEBHOOK_SECRET) return res.status(403).json({ok:false});
  const upd=req.body||{};
  if(upd.pre_checkout_query){
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerPreCheckoutQuery`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pre_checkout_query_id:upd.pre_checkout_query.id,ok:true})});
    return res.json({ok:true});
  }
  const msg=upd.message;
  if(msg?.successful_payment){
    const sp=msg.successful_payment;
    const payload=sp.invoice_payload;
    const client=await pool.connect();
    try{
      await client.query('begin');
      const pay=(await client.query(`select * from star_payments where payload=$1 for update`,[payload])).rows[0];
      if(pay && pay.status!=='paid'){
        await client.query(`update star_payments set status='paid', telegram_payment_charge_id=$1, paid_at=now() where id=$2`,[sp.telegram_payment_charge_id||'', pay.id]);
        await client.query(`update users set balance=balance+$1,xp=xp+$2 where id=$3`,[pay.total_amount, Math.max(1,Math.floor(Number(pay.total_amount)/10)), pay.user_id]);
        await client.query(`insert into ledger(user_id,amount,kind,ref,meta) values($1,$2,'stars_payment',$3,$4)`,[pay.user_id,pay.total_amount,payload,JSON.stringify(sp)]);
      }
      await client.query('commit');
    }catch(e){ await client.query('rollback'); throw e; } finally{ client.release(); }
    return res.json({ok:true});
  }
  if(msg?.chat?.id && msg?.text?.startsWith('/start')) await sendStart(msg.chat.id);
  res.json({ok:true});
}catch(e){console.error(e); res.status(500).json({ok:false});} });

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`${APP} v10 on ${PORT}`));
