<#
Spark Bootstrap v2 (PowerShell‑safe) — FREE TIER ONLY
----------------------------------------------------
• Builds a clean monorepo that matches the **new brief**.
• **No Cloud Functions**. Uses Realtime Database only.
• All PowerShell pitfalls fixed (no accidental variable expansion, safe here‑strings, no BOM).

What it creates:
  /apps/hub                   Vite + React minimal lobby UI
  /packages/game-sdk          RoomClient, types, presence, chat
  /packages/avatars           Presets + doodle editor stub + render
  /packages/ui                Tiny shared components
  /infra/firebase             database.rules.json + .firebaserc + firebase.json

After the script prints NEXT STEPS, deploy rules (free) and run the app.
#>

param(
  [string]$ProjectId = "",
  [string]$DatabaseURL = ""
)

# ---------------- Helpers ----------------
function Write-Utf8NoBom {
  param([string]$Path, [string]$Content)
  $dir = [System.IO.Path]::GetDirectoryName($Path)
  if ($dir -and -not (Test-Path $dir)) { [System.IO.Directory]::CreateDirectory($dir) | Out-Null }
  $enc = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $enc)
}
function Fill([string]$s){
  $s = $s.Replace('__PROJECT_ID__', $ProjectId)
  $s = $s.Replace('__DATABASE_URL__', $DatabaseURL)
  return $s
}
function Json { param([Parameter(ValueFromPipeline=$true)]$obj, [int]$Depth=100) ($obj | ConvertTo-Json -Depth $Depth) }
function Info($m){ Write-Host "[+] $m" -ForegroundColor Cyan }
function Done($m){ Write-Host "[✓] $m" -ForegroundColor Green }
function Warn($m){ Write-Host "[!] $m" -ForegroundColor Yellow }

# ---------------- Prompt ----------------
if (-not $ProjectId) { $ProjectId  = Read-Host "Enter Firebase Project ID (e.g. web-games-953fb)" }
if (-not $DatabaseURL) { $DatabaseURL = Read-Host "Paste your Realtime Database URL (exactly as shown in Console)" }
if (-not $ProjectId -or -not $DatabaseURL) { throw "ProjectId and DatabaseURL are required" }

# ---------------- Root scaffold ----------------
$Root = Join-Path (Get-Location) 'creative-hub-spark'
if (-not (Test-Path $Root)) { New-Item -ItemType Directory -Path $Root | Out-Null }
Set-Location $Root

$pkgRoot = @{ name = 'creative-webapp-hub'; private = $true; version = '0.1.0'; packageManager = 'pnpm@9.0.0'; workspaces = @('apps/*','packages/*'); scripts = @{ build = 'pnpm -r build'; dev = 'pnpm --filter @app/hub dev' } } | Json
Write-Utf8NoBom "$Root/package.json" $pkgRoot

$tsBase = @'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
'@
Write-Utf8NoBom "$Root/tsconfig.base.json" $tsBase

$workspace = @'
packages:
  - "apps/*"
  - "packages/*"
'@
Write-Utf8NoBom "$Root/pnpm-workspace.yaml" $workspace

$readme = @'
# Creative Web App Hub (Spark‑only)

This repo runs **without Cloud Functions** (free tier). It uses Firebase **Realtime Database** only.

## Local setup
1) Create/confirm your RTDB instance in Firebase Console.
2) Deploy rules: `cd infra/firebase && firebase use <PROJECT_ID> && firebase deploy --only database`.
3) Run the app: `pnpm --filter @app/hub dev` and open the printed URL.

## GitHub Pages (free)
- Build site: `pnpm --filter @app/hub build` → `apps/hub/dist`.
- Enable Pages with a workflow that uploads `apps/hub/dist`.

### Example workflow (optional)
```yaml
name: Deploy Hub to Pages
on:
  push:
    branches: [ main ]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm install
      - run: pnpm --filter @app/hub build
      - uses: actions/upload-pages-artifact@v3
        with: { path: apps/hub/dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
'@
Write-Utf8NoBom "$Root/README.md" $readme

# ---------------- apps/hub ----------------
$AppDir = "$Root/apps/hub"
New-Item -ItemType Directory -Path "$AppDir/src" -Force | Out-Null

$pkgApp = @{ name='@app/hub'; version='0.1.0'; private=$true; type='module'; scripts=@{ dev='vite'; build='vite build'; preview='vite preview' }; dependencies=@{ react='18.3.1'; 'react-dom'='18.3.1'; firebase='10.12.5'; '@sdk/game-sdk'='workspace:*'; '@pkg/avatars'='workspace:*'; '@pkg/ui'='workspace:*' }; devDependencies=@{ typescript='5.5.4'; vite='5.4.2'; '@types/react'='18.3.3'; '@types/react-dom'='18.3.0'; '@vitejs/plugin-react'='4.3.1' } } | Json
Write-Utf8NoBom "$AppDir/package.json" $pkgApp

$indexHtml = @'
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Creative Hub – Lobby</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
'@
Write-Utf8NoBom "$AppDir/index.html" $indexHtml

$tsApp = @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "types": ["vite/client"] },
  "include": ["src"]
}
'@
Write-Utf8NoBom "$AppDir/tsconfig.json" $tsApp

$viteCfg = @'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })
'@
Write-Utf8NoBom "$AppDir/vite.config.ts" $viteCfg

$styles = @'
:root { color-scheme: dark; font-family: Inter, system-ui, Arial; }
* { box-sizing: border-box; }
body { margin: 0; background: #0d0f14; color: #e5e7eb; }
.container { max-width: 960px; margin: 0 auto; padding: 24px; }
.row { display: flex; gap: 12px; flex-wrap: wrap; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; }
.small { font-size: 12px; opacity: 0.8; }
.code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
hr { border: none; border-top: 1px solid #1f2937; margin: 16px 0; }
.card { background: #10131a; border: 1px solid #1f2937; border-radius: 12px; padding: 16px; }
.list { display: grid; gap: 8px; }
input, button, textarea { font: inherit; }
input, textarea { background: #0b0e14; border: 1px solid #263041; color: #e5e7eb; border-radius: 10px; padding: 10px 12px; }
button { background: #2563eb; border: none; border-radius: 10px; padding: 10px 14px; color: white; cursor: pointer; }
button.secondary { background: #374151; }
.inline { display: inline-flex; align-items: center; gap: 8px; }
avatar { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; background: #111827; display: grid; place-items: center; }
.chat { max-height: 240px; overflow: auto; display: grid; gap: 6px; }
input.upper { text-transform: uppercase; letter-spacing: 2px; }
label { display: block; margin-bottom: 6px; font-size: 12px; color: #93a0b4; }
.field { display: grid; gap: 6px; margin-bottom: 12px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 640px) { .two { grid-template-columns: 1fr; } }
'@
Write-Utf8NoBom "$AppDir/src/styles.css" $styles

$fbCfgTs = @'
// Filled by bootstrap script
export const firebaseConfig = {
  apiKey: 'CHANGE_ME',
  authDomain: '__PROJECT_ID__.firebaseapp.com',
  databaseURL: '__DATABASE_URL__',
  projectId: '__PROJECT_ID__',
  storageBucket: '__PROJECT_ID__.appspot.com',
  messagingSenderId: '',
  appId: ''
}
'@
Write-Utf8NoBom "$AppDir/src/firebase-config.ts" (Fill $fbCfgTs)

$mainTsx = @'
import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App'
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
'@
Write-Utf8NoBom "$AppDir/src/main.tsx" $mainTsx

$appTsx = @'
import React, { useEffect, useMemo, useState } from 'react'
import { RoomClient } from '@sdk/game-sdk'
import { firebaseConfig } from './firebase-config'
import { AvatarEditorStub, getPresetIds, renderAvatar } from '@pkg/avatars'
import { Button, Input } from '@pkg/ui'

function useRoomClient() { return useMemo(() => new RoomClient({ firebaseConfig }), []) }
const MAX_NAME = 20

export default function App() {
  const client = useRoomClient()
  const [view, setView] = useState<'home'|'lobby'>('home')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [chatText, setChatText] = useState('')
  const [chatTick, setChatTick] = useState(0)
  const [avatar, setAvatar] = useState<any>(null)
  const presetIds = getPresetIds()

  useEffect(() => client.onPlayers(setPlayers), [client])
  useEffect(() => client.onRoomMeta(setRoom), [client])
  useEffect(() => client.onChat(() => setChatTick(t=>t+1)), [client])

  const createRoom = async () => {
    const nickname = name.trim().slice(0, MAX_NAME) || 'Guest'
    await client.createRoom({ slug: 'typing-race', version: '0.1.0', name: nickname, avatar })
    setView('lobby')
  }
  const joinRoom = async () => {
    const nickname = name.trim().slice(0, MAX_NAME) || 'Guest'
    await client.joinRoomByCode({ code: code.trim().toUpperCase(), name: nickname, avatar })
    setView('lobby')
  }
  const sendChat = async () => { const t = chatText.trim(); if (!t) return; await client.sendText(t); setChatText('') }

  return (
    <div className="container">
      <h1>Creative Hub</h1>
      {view === 'home' && (
        <div className="card">
          <div className="two">
            <div>
              <div className="field"><label>Nickname</label><Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Up to 20 chars" maxLength={MAX_NAME} /></div>
              <div className="field"><label>Join Code</label><Input className="upper" value={code} onChange={(e)=>setCode(e.target.value)} placeholder="AB12" maxLength={4} /></div>
              <div className="row"><Button onClick={createRoom}>Create Room</Button><Button className="secondary" onClick={joinRoom}>Join Room</Button></div>
              <p className="small">Spark-only: no Cloud Functions needed.</p>
            </div>
            <div>
              <h3>Avatar</h3>
              <div className="grid">
                {presetIds.map((id)=> (
                  <button key={id} onClick={()=>setAvatar({ kind:'preset', id })} className="avatar" aria-label={`Preset ${id}`}>
                    {renderAvatar({ kind:'preset', id }, 48)}
                  </button>
                ))}
                <AvatarEditorStub value={avatar} onChange={setAvatar} />
              </div>
            </div>
          </div>
        </div>
      )}
      {view === 'lobby' && (
        <div className="card">
          <div className="row" style={{justifyContent:'space-between'}}>
            <div><div className="small">Room Code</div><div className="code" style={{fontSize:24}}>{room?.joinCode ?? '----'}</div></div>
            <div><div className="small">Status</div><div style={{fontSize:18}}>{room?.status ?? 'lobby'}</div></div>
          </div>
          <hr />
          <h3>Players</h3>
          <div className="list">
            {players.map(p => (
              <div key={p.id} className="inline">
                <div className="avatar">{renderAvatar(p.avatar, 48)}</div>
                <div><div>{p.name} <span className="small">({p.role})</span></div></div>
              </div>
            ))}
          </div>
          <hr />
          <h3>Chat</h3>
          <div className="chat">
            {client.chat.map(m => (
              <div key={m.id}><span className="small">[{new Date(m.createdAt).toLocaleTimeString()}] </span><strong>{m.name}: </strong><span>{m.text}</span></div>
            ))}
          </div>
          <div className="row" style={{marginTop:8}}>
            <Input value={chatText} onChange={(e)=>setChatText(e.target.value)} placeholder="Say hi" maxLength={160} />
            <Button onClick={sendChat}>Send</Button>
          </div>
        </div>
      )}
    </div>
  )
}
'@
Write-Utf8NoBom "$AppDir/src/App.tsx" $appTsx

# ---------------- packages/game-sdk ----------------
$SdkDir = "$Root/packages/game-sdk"
New-Item -ItemType Directory -Path "$SdkDir/src" -Force | Out-Null

$pkgSdk = @{
  name='@sdk/game-sdk'; version='0.1.0'; private=$true; type='module';
  main='dist/index.js'; types='dist/index.d.ts';
  exports = @{ '."' = $null }; # placeholder to keep shape
  scripts=@{ build='tsc -p tsconfig.json' };
  dependencies=@{ firebase='10.12.5' };
  devDependencies=@{ typescript='5.5.4' }
} | Json
# Fix exports properly (ConvertTo-Json doesn't like nested types mapping)
$pkgSdk = $pkgSdk.Replace('"." : null', '"." : { "types": "./dist/index.d.ts", "default": "./dist/index.js" }')
Write-Utf8NoBom "$SdkDir/package.json" $pkgSdk

$tsSdk = @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "declaration": true },
  "include": ["src"]
}
'@
Write-Utf8NoBom "$SdkDir/tsconfig.json" $tsSdk

$typesTs = @'
export const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const
export const JOIN_CODE_LEN = 4
export const MAX_NAME_LEN = 20
export const CHAT_MAX_LEN = 160
export const MAX_PLAYERS_DEFAULT = 8
export const HEARTBEAT_MS = 10000
export const PRESENCE_TIMEOUT_MS = 45000

export type RoomStatus = 'lobby' | 'starting' | 'inGame' | 'ended'
export interface Room { id: string; slug: string; version: string; joinCode: string; private: boolean; maxPlayers: number; status: RoomStatus; hostId: string; createdAt: number; options?: { slowModeMs?: number; spectators?: boolean; reactions?: boolean } }
export interface AvatarMeta { w?: number; h?: number; size?: 64; palette?: string[]; bg?: number; createdAt?: number; hash?: string }
export type Avatar = { kind: 'doodle'; meta: AvatarMeta; rle: string } | { kind: 'preset'; id: string }
export type PlayerRole = 'host' | 'player' | 'spectator'
export interface Player { id: string; name: string; role: PlayerRole; avatar?: Avatar; mutedUntil?: number; lastSeen: number }
export type ChatType = 'text' | 'system' | 'reaction' | 'poll'
export interface ChatMessage { id: string; roomId: string; playerId: string; name: string; createdAt: number; type: ChatType; text?: string }
'@
Write-Utf8NoBom "$SdkDir/src/types.ts" $typesTs

$firebaseTs = @'
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getDatabase, ref, onValue, onDisconnect, push, set, update, get, runTransaction, type Database } from 'firebase/database'
export type FirebaseBits = { app: FirebaseApp; db: Database }
export function initFirebase(firebaseConfig: Record<string, any>): FirebaseBits { const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig); const db = getDatabase(app); return { app, db } }
export { ref, onValue, onDisconnect, push, set, update, get, runTransaction }
'@
Write-Utf8NoBom "$SdkDir/src/firebase.ts" $firebaseTs

$roomClientTs = @'
import { initFirebase, ref, onValue, push, set, update, onDisconnect, get, runTransaction } from './firebase'
import type { Room, Player, ChatMessage, Avatar } from './types'
import { MAX_NAME_LEN, CHAT_MAX_LEN, JOIN_CODE_ALPHABET, JOIN_CODE_LEN, MAX_PLAYERS_DEFAULT, HEARTBEAT_MS } from './types'

const DEFAULT_PRESETS = ['p1','p2','p3','p4','p5','p6','p7','p8']
const pickPresetId = () => DEFAULT_PRESETS[Math.floor(Math.random()*DEFAULT_PRESETS.length)]

function randomCode(len = JOIN_CODE_LEN) { let s=''; for(let i=0;i<len;i++) s+= JOIN_CODE_ALPHABET[Math.floor(Math.random()*JOIN_CODE_ALPHABET.length)]; return s }
function uuidv4(){ const c = crypto.getRandomValues(new Uint8Array(16)); c[6]=(c[6]&0x0f)|0x40; c[8]=(c[8]&0x3f)|0x80; const h=(n:number)=>n.toString(16).padStart(2,'0'); const s=Array.from(c,h).join(''); return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}` }
function ensureGuestId(){ let id=localStorage.getItem('guestId'); if(!id){ id=uuidv4(); localStorage.setItem('guestId', id) } return id }

export type CreateRoomInput = { slug: string; version: string; name: string; avatar?: Avatar | null; private?: boolean; maxPlayers?: number }
export type JoinByCodeInput = { code: string; name: string; avatar?: Avatar | null }

type Unsub = () => void

export class RoomClient {
  private fb; private guestId: string
  public room: Room | null = null; public roomId: string | null = null
  public players: Player[] = []; public chat: ChatMessage[] = []
  private heart?: any; private unsubFns: Unsub[] = []; private subscribed = false
  private playersListeners: Array<(p: Player[])=>void> = []
  private roomListeners: Array<(r: Room|null)=>void> = []
  private chatListeners: Array<(c: ChatMessage[])=>void> = []

  constructor(opts: { firebaseConfig: Record<string, any> }) { this.fb = initFirebase(opts.firebaseConfig); this.guestId = ensureGuestId() }

  private notifyPlayers(){ this.playersListeners.forEach(cb=>cb(this.players)) }
  private notifyRoom(){ this.roomListeners.forEach(cb=>cb(this.room)) }
  private notifyChat(){ this.chatListeners.forEach(cb=>cb(this.chat)) }

  onPlayers(cb: (players: Player[]) => void){ this.playersListeners.push(cb); if(this.players.length) cb(this.players); return ()=>{ this.playersListeners = this.playersListeners.filter(f=>f!==cb) } }
  onRoomMeta(cb: (room: Room|null)=>void){ this.roomListeners.push(cb); if(this.room) cb(this.room); return ()=>{ this.roomListeners = this.roomListeners.filter(f=>f!==cb) } }
  onChat(cb: (msgs: ChatMessage[])=>void){ this.chatListeners.push(cb); if(this.chat.length) cb(this.chat); return ()=>{ this.chatListeners = this.chatListeners.filter(f=>f!==cb) } }

  private attachSubscriptions(){ if(this.subscribed || !this.roomId) return; this.subscribed = true
    const playersRef = ref(this.fb.db, `rooms/${this.roomId}/players`)
    const roomRef = ref(this.fb.db, `rooms/${this.roomId}/meta`)
    const chatRef = ref(this.fb.db, `rooms/${this.roomId}/chat`)
    const u1 = onValue(playersRef, (snap)=>{ const val=snap.val()||{}; const list: Player[] = Object.values(val); this.players = list.sort((a,b)=> a.name.localeCompare(b.name)); this.notifyPlayers() })
    const u2 = onValue(roomRef, (snap)=>{ this.room = (snap.val()||null); this.notifyRoom() })
    const u3 = onValue(chatRef, (snap)=>{ const val=snap.val()||{}; const list: ChatMessage[] = Object.entries(val).map(([id,v]:any)=>({id, ...v})); this.chat = list.sort((a,b)=> a.createdAt - b.createdAt); this.notifyChat() })
    this.unsubFns.push(()=>u1(), ()=>u2(), ()=>u3())
  }

  private startPresence(name: string, avatar?: Avatar | null){ if(!this.roomId) return
    const now = Date.now()
    const assignedAvatar: Avatar | undefined = avatar ?? { kind:'preset', id: pickPresetId() }
    const p: Player = { id:this.guestId, name, role: this.room?.hostId===this.guestId ? 'host':'player', avatar: assignedAvatar, lastSeen: now }
    const pRef = ref(this.fb.db, `rooms/${this.roomId}/players/${this.guestId}`)
    const presRef = ref(this.fb.db, `rooms/${this.roomId}/presence/${this.guestId}`)
    set(pRef, p)
    set(presRef, { lastSeen: now })
    const discP = onDisconnect(pRef); discP.remove()
    const discPr = onDisconnect(presRef); discPr.remove()
    if(this.heart) clearInterval(this.heart)
    this.heart = setInterval(()=>{ const t=Date.now(); update(pRef,{ lastSeen:t }); set(presRef,{ lastSeen:t }) }, HEARTBEAT_MS)
  }

  private async allocateCode(roomId: string): Promise<string>{ for(let i=0;i<32;i++){ const code = randomCode(); const codeRef = ref(this.fb.db, `codes/${code}`); const res = await runTransaction(codeRef, (cur)=> cur ? cur : { roomId, createdAt: Date.now() }); if (res.committed) return code } throw new Error('Could not allocate join code') }

  async createRoom(input: CreateRoomInput){ const roomRef = push(ref(this.fb.db, 'rooms')); const roomId = roomRef.key!; const joinCode = await this.allocateCode(roomId); const now = Date.now(); const room: Room = { id: roomId, slug: input.slug, version: input.version, joinCode, private: !!input.private, maxPlayers: input.maxPlayers ?? MAX_PLAYERS_DEFAULT, status: 'lobby', hostId: this.guestId, createdAt: now, options: {} } as Room; const assignedAvatar: Avatar | undefined = input.avatar ?? { kind:'preset', id: pickPresetId() }; const player: Player = { id: this.guestId, name: String(input.name).slice(0,MAX_NAME_LEN), role: 'host', avatar: assignedAvatar, lastSeen: now }
    await update(ref(this.fb.db), { [`rooms/${roomId}/meta`]: room, [`rooms/${roomId}/players/${this.guestId}`]: player })
    this.roomId = roomId; this.room = room; this.attachSubscriptions(); this.startPresence(input.name, assignedAvatar); return room }

  async joinRoomByCode(input: JoinByCodeInput){ const code = String(input.code).toUpperCase(); const mapSnap = await get(ref(this.fb.db, `codes/${code}`)); if(!mapSnap.exists()) throw new Error('ERR_CODE_NOT_FOUND'); const { roomId } = mapSnap.val(); const metaSnap = await get(ref(this.fb.db, `rooms/${roomId}/meta`)); if(!metaSnap.exists()) throw new Error('Room not found'); const room = metaSnap.val() as Room; const now = Date.now(); const assignedAvatar: Avatar | undefined = input.avatar ?? { kind:'preset', id: pickPresetId() }; const player: Player = { id: this.guestId, name: String(input.name).slice(0,MAX_NAME_LEN), role: room.hostId===this.guestId ? 'host':'player', avatar: assignedAvatar, lastSeen: now }; await set(ref(this.fb.db, `rooms/${roomId}/players/${this.guestId}`), player); this.roomId = roomId; this.room = room; this.attachSubscriptions(); this.startPresence(input.name, assignedAvatar); return room }

  async sendText(text: string){ if(!this.roomId) throw new Error('Not in room'); const trimmed = text.slice(0,CHAT_MAX_LEN); const chatRef = ref(this.fb.db, `rooms/${this.roomId}/chat`); const msg: Omit<ChatMessage,'id'> = { roomId: this.roomId, playerId: this.guestId, name: this.players.find(p=>p.id===this.guestId)?.name ?? 'Guest', createdAt: Date.now(), type: 'text', text: trimmed }; await set(push(chatRef), msg) }
}
'@
Write-Utf8NoBom "$SdkDir/src/RoomClient.ts" $roomClientTs

$indexSdk = @'
export * from './types'
export * from './RoomClient'
'@
Write-Utf8NoBom "$SdkDir/src/index.ts" $indexSdk

# ---------------- packages/avatars ----------------
$AvDir = "$Root/packages/avatars"
New-Item -ItemType Directory -Path "$AvDir/src" -Force | Out-Null

$pkgAv = @{ name='@pkg/avatars'; version='0.1.0'; private=$true; type='module'; main='dist/index.js'; types='dist/index.d.ts'; scripts=@{ build='tsc -p tsconfig.json' }; devDependencies=@{ typescript='5.5.4'; react='18.3.1'; '@types/react'='18.3.3' }; peerDependencies=@{ react='>=18' } } | Json
Write-Utf8NoBom "$AvDir/package.json" $pkgAv

$tsAv = @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "declaration": true },
  "include": ["src"]
}
'@
Write-Utf8NoBom "$AvDir/tsconfig.json" $tsAv

$presets = @'
export const PRESET_SVGS: Record<string, string> = {
  'p1': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#1e293b'/><circle cx='32' cy='24' r='12' fill='#38bdf8'/><rect x='12' y='38' width='40' height='14' rx='7' fill='#94a3b8'/></svg>`,
  'p2': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#111827'/><circle cx='22' cy='24' r='10' fill='#f59e0b'/><circle cx='42' cy='24' r='10' fill='#ef4444'/><rect x='14' y='40' width='36' height='8' rx='4' fill='#22c55e'/></svg>`,
  'p3': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#0f172a'/><path d='M8 40 L32 12 L56 40 Z' fill='#60a5fa'/><circle cx='32' cy='45' r='6' fill='#f8fafc'/></svg>`,
  'p4': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#1f2937'/><rect x='14' y='14' width='36' height='36' rx='8' fill='#a78bfa'/></svg>`,
  'p5': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#0b1020'/><circle cx='32' cy='32' r='20' fill='#22c55e'/><circle cx='26' cy='28' r='4' fill='#052e16'/><circle cx='38' cy='28' r='4' fill='#052e16'/><rect x='24' y='38' width='16' height='4' rx='2' fill='#052e16'/></svg>`,
  'p6': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#111827'/><rect x='12' y='28' width='40' height='8' rx='4' fill='#eab308'/><rect x='12' y='18' width='40' height='8' rx='4' fill='#3b82f6'/><rect x='12' y='38' width='40' height='8' rx='4' fill='#ef4444'/></svg>`,
  'p7': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#020617'/><circle cx='32' cy='32' r='24' fill='#10b981'/><rect x='20' y='28' width='24' height='8' rx='4' fill='#064e3b'/></svg>`,
  'p8': `<svg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'><rect width='64' height='64' rx='12' fill='#0a0f1f'/><path d='M12 52 L52 12' stroke='#f43f5e' stroke-width='8' stroke-linecap='round'/><path d='M12 12 L52 52' stroke='#38bdf8' stroke-width='8' stroke-linecap='round'/></svg>`
}
export function getPresetIds(): string[] { return Object.keys(PRESET_SVGS) }
'@
Write-Utf8NoBom "$AvDir/src/presets.ts" $presets

$renderAvatar = @'
import React from 'react'
import { PRESET_SVGS } from './presets'
import type { Avatar } from '@sdk/game-sdk'
export function pickRandomPreset(): Avatar { const ids=Object.keys(PRESET_SVGS); const id=ids[Math.floor(Math.random()*ids.length)]; return { kind:'preset', id } }
export function renderAvatar(avatar: Avatar | undefined, size=48){ let a=avatar; if(!a) a=pickRandomPreset(); if(a.kind==='preset'){ const svg=PRESET_SVGS[a.id] || PRESET_SVGS['p1']; const data = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`; return <img alt="avatar" width={size} height={size} src={data} /> } const canvas=document.createElement('canvas'); canvas.width=64; canvas.height=64; const url=canvas.toDataURL('image/png'); return <img alt="avatar" width={size} height={size} src={url} /> }
'@
Write-Utf8NoBom "$AvDir/src/renderAvatar.tsx" $renderAvatar

$editorStub = @'
import React, { useMemo, useRef, useState } from 'react'
import type { Avatar } from '@sdk/game-sdk'
import { pickRandomPreset, renderAvatar } from './renderAvatar'
export function AvatarEditorStub({ value, onChange }: { value: Avatar | null | undefined, onChange: (a: Avatar)=>void }){
  const [seed] = useState(Math.random()); const ref = useRef<HTMLCanvasElement>(null); const palette = useMemo(()=>['#000000','#ffffff','#f43f5e','#22c55e','#3b82f6','#eab308','#a78bfa'],[])
  const makeDoodle = (): Avatar => { const canvas=ref.current!; const ctx=canvas.getContext('2d')!; ctx.fillStyle='#0b0e14'; ctx.fillRect(0,0,64,64); ctx.fillStyle = palette[Math.floor(seed*palette.length)]; ctx.fillRect(8,8,48,48); return { kind:'doodle', meta:{ w:64,h:64, palette }, rle:'stub' } }
  return (<div><button className="avatar" onClick={()=> onChange(makeDoodle()) } title="Doodle (stub)"><canvas ref={ref} width={64} height={64} style={{display:'none'}} />{renderAvatar(value ?? pickRandomPreset(), 48)}</button></div>)
}
'@
Write-Utf8NoBom "$AvDir/src/AvatarEditorStub.tsx" $editorStub

$indexAv = @'
export * from './presets'
export * from './renderAvatar'
export * from './AvatarEditorStub'
'@
Write-Utf8NoBom "$AvDir/src/index.ts" $indexAv

# ---------------- packages/ui ----------------
$UiDir = "$Root/packages/ui"
New-Item -ItemType Directory -Path "$UiDir/src" -Force | Out-Null

$pkgUi = @{ name='@pkg/ui'; version='0.1.0'; private=$true; type='module'; main='dist/index.js'; types='dist/index.d.ts'; scripts=@{ build='tsc -p tsconfig.json' }; devDependencies=@{ typescript='5.5.4'; react='18.3.1'; '@types/react'='18.3.3' }; peerDependencies=@{ react='>=18' } } | Json
Write-Utf8NoBom "$UiDir/package.json" $pkgUi

$tsUi = @'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "declaration": true },
  "include": ["src"]
}
'@
Write-Utf8NoBom "$UiDir/tsconfig.json" $tsUi

$uiButton = @'
import React from 'react'
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }> = ({ className, ...props }) => (
  <button {...props} className={["", className].filter(Boolean).join(' ')} />
)
'@
Write-Utf8NoBom "$UiDir/src/Button.tsx" $uiButton

$uiInput = @'
import React from 'react'
export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { className?: string }> = ({ className, ...props }) => (
  <input {...props} className={[className].filter(Boolean).join(' ')} />
)
'@
Write-Utf8NoBom "$UiDir/src/Input.tsx" $uiInput

$uiCard = @'
import React from 'react'
export const Card: React.FC<React.PropsWithChildren<{ className?: string }>> = ({ className, children }) => (
  <div className={["card", className].filter(Boolean).join(' ')}>{children}</div>
)
'@
Write-Utf8NoBom "$UiDir/src/Card.tsx" $uiCard

$uiAvatar = @'
import React from 'react'
export const AvatarBox: React.FC<React.PropsWithChildren<{ size?: number }>> = ({ size=48, children }) => (
  <div style={{ width:size, height:size }} className="avatar">{children}</div>
)
'@
Write-Utf8NoBom "$UiDir/src/Avatar.tsx" $uiAvatar

$uiIndex = @'
export * from './Button'
export * from './Input'
export * from './Card'
export * from './Avatar'
'@
Write-Utf8NoBom "$UiDir/src/index.ts" $uiIndex

# ---------------- infra/firebase (NO FUNCTIONS) ----------------
$Infra = "$Root/infra/firebase"
New-Item -ItemType Directory -Path $Infra -Force | Out-Null

$firebaseJson = @'
{
  "database": { "rules": "database.rules.json" }
}
'@
Write-Utf8NoBom "$Infra/firebase.json" $firebaseJson
Write-Utf8NoBom "$Infra/.firebaserc" (@{ projects = @{ default = $ProjectId } } | Json)

$rules = @'
{
  "rules": {
    ".read": true,
    ".write": false,

    "rooms": {
      "$roomId": {
        "meta": {
          ".read": true,
          ".write": "!data.exists()",
          ".validate": "newData.hasChildren(['id','slug','version','joinCode','private','maxPlayers','status','hostId','createdAt']) && newData.child('id').val() == $roomId && newData.child('joinCode').isString() && newData.child('joinCode').val().matches(/^[A-Z0-9]{4}$/) && newData.child('status').val().matches(/^(lobby|starting|inGame|ended)$/) && newData.child('maxPlayers').isNumber() && newData.child('createdAt').isNumber()"
        },
        "players": {
          ".read": true,
          "$playerId": {
            ".write": true,
            ".validate": "newData.hasChildren(['id','name','role','lastSeen']) && newData.child('id').val() == $playerId && newData.child('name').isString() && newData.child('name').val().length <= 20 && newData.child('role').val().matches(/^(host|player|spectator)$/) && newData.child('lastSeen').isNumber()"
          }
        },
        "presence": {
          ".read": true,
          "$playerId": { 
            ".write": true,
            ".validate": "newData.hasChildren(['lastSeen']) && newData.child('lastSeen').isNumber()"
          }
        },
        "chat": {
          ".read": true,
          "$msgId": {
            ".write": true,
            ".validate": "newData.hasChildren(['roomId','playerId','name','createdAt','type']) && newData.child('roomId').val() == $roomId && newData.child('name').isString() && newData.child('name').val().length <= 20 && newData.child('type').val().matches(/^(text|system|reaction|poll)$/) && (!newData.child('text').exists() || (newData.child('text').isString() && newData.child('text').val().length <= 160)) && newData.child('createdAt').isNumber()"
          }
        }
      }
    },

    "codes": {
      ".read": true,
      "$code": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['roomId','createdAt']) && newData.child('roomId').isString() && newData.child('createdAt').isNumber() && $code.matches(/^[A-Z0-9]{4}$/)"
      }
    }
  }
}
'@
Write-Utf8NoBom "$Infra/database.rules.json" $rules

# ---------------- Install & build ----------------
Info "Installing workspace dependencies…"
cmd /c pnpm install
if ($LASTEXITCODE -ne 0) { Warn "pnpm install exited with code $LASTEXITCODE" }

Info "Building packages…"
cmd /c pnpm -r build
if ($LASTEXITCODE -ne 0) { Warn "Some builds failed. You can re-run: pnpm -r build" }

# ---------------- Next steps ----------------
$next = @'

NEXT STEPS
----------
1) Deploy RTDB rules (free):
   cd infra/firebase
   firebase use __PROJECT_ID__
   firebase deploy --only database

2) Run the app locally:
   cd ../../
   pnpm --filter @app/hub dev
   # open the printed localhost URL

3) Smoke test:
   - Create Room → note 4-char code
   - Join from another tab → enter code
   - Send chat (≤160 chars); presence updates every 10s

Notes:
- This scaffold matches the **new brief** and uses only free-tier features.
- Later, when/if you move to Blaze, the data model already matches a Functions migration.
'@
Write-Host (Fill $next)
Done "Scaffold ready at: $Root"
