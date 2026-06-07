require('dotenv').config()
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const Groq = require('groq-sdk')
const axios = require('axios')
const http = require('http')
const pino = require('pino')
const QRCode = require('qrcode')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const OWNER = process.env.OWNER_NUMBER + '@s.whatsapp.net'

let qrImageUrl = null
let botConectado = false

// ============================================================
// CATÁLOGO DE PRODUCTOS
// ============================================================
const CATALOGO = `
=== ALMACÉN 19 (+10 CUP encima del toque) ===
- Cerveza Coprove: 0.49 USD (cajas x24 u)
- Jugo de lata Sunchy: 0.54 USD mínimo 1 caja (cajas x24 u) sabores: Banana, Tamarindo, Guayaba, Pera, Mango
- Refresco Ironbeer: 0.54 USD (cajas x24 u)
- Refresco Piñita: 0.54 USD mínimo 10 cajas (cajas x24 u)
- Cemento Chagres 42.5 kg: 22 USD
- Caja Porcelanato 1.44m (4 losas 60x60): 30 USD

=== ALMACÉN 18 (+15 CUP encima del toque) ===
Huevo Perla:
  - Blanco: 4.3 USD efectivo | 2632.5 CUP transferencia
  - Marrón: 4.2 USD efectivo | 2632.5 CUP transferencia
Arroz saco 50kg:
  - Por saco: 47 USD efectivo | por contenedor: 45 USD efectivo
  - Transferencia: 52 USD equivalente
Aceite Semilla: 2.10 USD x contenedor | 2.15 USD x unidad/caja
Frijoles negros saco 50kg: 58 USD
Leche condensada: 519 CUP (0.90 USD) por lata

=== ALMACÉN 20 (mensajería: 56237509) ===
- Galletas María 90g: 190 CUP (cajas x24 u)
- Souffle 30g: 116.67 CUP (cajas x24 u)
- Wafer RULIX 45g: 125 CUP (cajas x24 u)
- Wafer MARDAN 30g: 95.84 CUP (cajas x24 u)
- Malvaviscos 30g: 116.67 CUP (cajas x24 u)
- Wafer 77 XXL: 137 CUP (cajas x24 u)
- Refresco Bien Fría (limón, naranja, manzana): 240 CUP
- Pasta tomate 850g: 650 CUP (cajas x12 u)
- Cerveza Bien Fría 5%: 260 CUP
- Galletas LOLA (paquetes x12): 66.77 CUP
- Espagueti 500g: 240 CUP

=== ALMACÉN 5 / 5.1 / 5.2 ===
- Pollo Muslo caja (4 pqts 40lb): 17700 CUP o 30.5 USD
- Lomo deshuesado: 1200 CUP/lb o 2.05 USD/lb
- Leche Evaporada caja x24: 15100 CUP (650 CUP/lata)
- Mayonesa Nezka 494ml caja x12: 10500 CUP (875 CUP/u)
- Masa de cerdo deshuesada: 1150 CUP/lb o 2.00 USD/lb
- Café Nezka 250g caja x20: 32800 CUP [almacén 5.1] / 31900 CUP [almacén 5.2]
- Chupa Chupa caja x16pqts x24u: 15360 CUP (960 CUP/pqt, 40 CUP/u)
- Huevo caja x12: 31200 CUP (2600 CUP/u)
- Batería Bluetti 2304 Wh: 1500 USD
- Batería Bluetti 1152 Wh: 680 USD
- Batería Bluetti 1024 Wh: 770 USD

=== ALMACÉN 6 (+15 encima del toque) ===
- Papitas Pan Pan 35g: 0.46 USD (sabores: tomate, BBQ, queso, picante) disponible sábado
- Arroz brasileño 1kg: 1.06 USD (pacas x30 u)
- Galleta María 90g: 0.32 USD (+1 caja) | 0.30 USD (+100 cajas)
- Wafer MARDAN 30g: 0.14 USD (+1 caja) | 0.13 USD (+20 cajas)
- Wafer RULIX 45g: 0.20 USD (+1 caja) | 0.19 USD (+20 cajas)
- Malvavisco 30g: 0.17 USD (caja x144 u)
- Refresco (manzana, naranja, limón): 0.41 USD (+1 caja) | 0.40 USD (+100 cajas)
- Spaghetti 500g: 0.38 USD
- Pasta tomate 850g: 1.12 USD (+1 caja) | 1.10 USD (+50 cajas)
- Leche en polvo 200g: 1.48 USD (x48 u)
Confituras (disponibles martes):
  - Peter Jimmy 40g Chocolate: 0.25 USD/u
  - Peter Jimmy 20g: 0.13 USD/u
  - Bombones 500g: 3.50 USD/bolsa
  - Bombones 250g: 1.75 USD/bolsa
  - Jimmy Cornet 25g: 0.26 USD/u
  - Peter Crash 40g: 0.23 USD/u
  - Peter Orient 80g: 0.47 USD/u
  - Nutella y Palitos 52g: 0.53 USD/u
  - Peter Maxtat 30g: 0.175 USD/u
  - Caramelos 170g: 1.00 USD/bolsa | Caramelos 90g: 0.60 USD/bolsa
  - Jimmy Toys 25g: 0.46 USD/u

=== ALMACÉN 7 ===
- Sopitas pollo 70g: 170 CUP (cajas x40 u)
- Leche condensada Tánamo: 500 CUP
- Café Ziva: 1700 CUP (cajas x20 u)
- Arroz 1kg: 570 CUP (cajas x30 u)
- Huevo: 2600 CUP (cajas x12 files)
- Galletas Crokantina 7 tacos: 1200 CUP (caja x24 u)

=== ALMACÉN 7.1 ===
- Jugo 200ml: 145 CUP (mango, piña, frambuesa, cóctel, albaricoque)
- Leche condensada La Granjera: 500 CUP (caja x24 u)
- Pasta tomate Castellun 400g: 370 CUP
- Huevo: 2600 CUP (cajas x12 files)

=== ALMACÉN 22 (+20 CUP encima del toque) ===
- Azúcar 1kg paca x10: 1.30 USD (+1 paca) | 1.29 USD (+300 pacas)
- Arroz brasileño 1kg: 1.05 USD
- Hamburguesas res 75g: 240 CUP (caj x40 u)
- Molleja 1kg: 2.36 USD (caja x10 u) | 2.00 USD (+100 cajas)
- Pomo agua 500ml: 0.27 USD
- Energizante Go+ caja x24: 0.50 USD
- Jugos varios sabores: 0.30 USD
- Detergente YAMY 500g: 0.67 USD (paca x25 u)
- Arroz 1kg paca x30: 1.20 USD/u
- Frijol negro 1kg paca x30: 1.30 USD/u
- Frijol negro 25kg: 31.5 USD
- Atún 140g: 0.80 USD (+1 caja) | 0.73 USD (+150 cajas)
- Mostaza 320ml: 1.98 USD (caja x24 u)
- Ketchup 320g: 1.75 USD (caja x24 u)
- Pasta tomate VIMA 3kg: 8.66 USD (caja x6 u)
- Coffee Mate: 4.00 USD (caja x24 u)
- Mayonesa casera 450g: 3.61 USD (caja x24 u)
- Salsa cóctel 225g: 1.58 USD
- Galleta ALDIVA elegance 60g: 0.38 USD (x24 u)
- Mantequilla 225g: 2.45 USD (caj x40 u)
Ron Santiago (caja x12 botellas):
  - Carta Blanca: 6.90 USD
  - Añejo Tradición: 9.50 USD
  - Añejo 8 años: 10.30 USD
  - Extra 11 años: 18.95 USD
  - Extra 12 años: 21.95 USD
  - Super Dry: 3.93 USD
  - Aguardiente: 3.54 USD
  - Ron Orange: 5.45 USD

=== ALMACÉN 21 ===
- Zumo de limón: 250 CUP (blíster x15 u)
- Miel 400ml: 430 CUP
- Detergente Silver Bright 500g: 420 CUP (paca x20)
- Detergente Silver Bright 900g: 630 CUP (paca x15)
- Mayonesa Saude: 760 CUP (x12)
- Espaguetis 500g: 240 CUP (x20)
- Compotas BabyFruit (durazno, frutas mixtas): 290 CUP (x24)
- Galletas Romo: 140 CUP (x24)
- Galletas Browni (chocolate, naranja, vainilla): 133 CUP (x24)
- Pasta tomate 850g: 740 CUP (x12)
- Galletas Hola (chocolate, vainilla): 160 CUP (x24)
- Leche Condensada Holland Park: 509 CUP (x24)
- Frijol negro 1kg paca x30: 755 CUP/u
- Saco arroz 50kg: 29620 CUP
- Mayonesa Celorrio: 1630 CUP (x12)
- Mayonesa HollandPark: 860 CUP (x12)
- Leche Evaporada Nezka: 685 CUP (x24)
- Gelatina 35g (fresa, uva, piña, naranja): 235 CUP (x48)
- Cerveza Eichbaum: 248 CUP (caja x24)
- Atún 140g: 425 CUP (x48)
- Jamonilla cerdo y pollo: 760 CUP (x24)
- Palomitas: 320 CUP (x32)
Aceite motor (compra +1000 USD):
  - 20w50 5lt semisintético: 20 USD
  - 15w40 5lt semisintético: 20 USD
  - 10w40 5lt sintético: 20 USD
  - 5w30 5lt sintético: 22 USD
  - Pomo 20L semisintético: 70 USD
`

// ============================================================
// TASA USD
// ============================================================
let tasaUSD = parseInt(process.env.TASA_MANUAL) || 385

async function getTasa() {
  if (!process.env.ELTOQUE_TOKEN) {
    tasaUSD = parseInt(process.env.TASA_MANUAL) || tasaUSD
    console.log(`💱 Tasa manual: ${tasaUSD} CUP/USD`)
    return
  }
  try {
    const { data } = await axios.get('https://tasas.eltoque.com/v1/trmi', {
      headers: { 'Authorization': `Bearer ${process.env.ELTOQUE_TOKEN}` }
    })
    if (data && data.USD) {
      tasaUSD = data.USD
      console.log(`💱 Tasa elToque: ${tasaUSD} CUP/USD`)
    }
  } catch(e) {
    console.log('⚠️  Error tasa elToque, usando manual:', tasaUSD)
  }
}

// ============================================================
// GROQ
// ============================================================
const historiales = {}

async function responder(mensaje, historial) {
  const sistema = `Eres el asistente de ventas de un almacén mayorista en Cuba. Atiendes por WhatsApp.

💱 Tasa USD hoy: ${tasaUSD} CUP (fuente: elToque - mercado informal)

Recargos por almacén sobre el toque:
- Almacén 19: toque + 10 CUP por USD
- Almacén 18: toque + 15 CUP por USD
- Almacén 6: toque + 15 CUP por USD
- Almacén 22: toque + 20 CUP por USD

CATÁLOGO:
${CATALOGO}

INSTRUCCIONES:
1. Responde preguntas de precios y disponibilidad buscando en el catálogo
2. Cuando des precios en USD también di el equivalente en CUP con la tasa del día
3. Para cerrar un pedido necesitas: nombre del cliente, producto y cantidad, forma de pago (efectivo USD, efectivo CUP o transferencia), dirección
4. Si no encuentras el producto o no puedes responder algo, escribe exactamente: ESCALAR
5. Sé amable, responde corto y usa pocos emojis
6. Habla natural como en Cuba, tutéalo al cliente`

  const resp = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: sistema },
      ...historial,
      { role: 'user', content: mensaje }
    ],
    max_tokens: 600,
    temperature: 0.5
  })
  return resp.choices[0].message.content
}

// ============================================================
// WHATSAPP
// ============================================================
async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrImageUrl = await QRCode.toDataURL(qr)
      botConectado = false
      console.log('📱 QR generado — abre tu URL de Render para escanearlo')
    }
    if (connection === 'open') {
      botConectado = true
      qrImageUrl = null
      console.log('✅ WhatsApp conectado!')
    }
    if (connection === 'close') {
      botConectado = false
      const reconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (reconectar) {
        console.log('🔄 Reconectando...')
        iniciar()
      } else {
        console.log('❌ Sesión cerrada. Abre la URL de Render para escanear el QR.')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    if (from === 'status@broadcast') return

    const texto = msg.message.conversation ||
                  msg.message.extendedTextMessage?.text || ''
    if (!texto.trim()) return

    if (!historiales[from]) historiales[from] = []

    try {
      await sock.sendPresenceUpdate('composing', from)
      const respuesta = await responder(texto, historiales[from])

      historiales[from].push({ role: 'user', content: texto })
      historiales[from].push({ role: 'assistant', content: respuesta })

      if (historiales[from].length > 20) {
        historiales[from] = historiales[from].slice(-20)
      }

      if (respuesta.includes('ESCALAR')) {
        await sock.sendMessage(OWNER, {
          text: `🚨 *Cliente necesita atención*\nNúmero: ${from}\nPreguntó: "${texto}"`
        })
        await sock.sendMessage(from, {
          text: 'Esa pregunta la responde el dueño directamente, te contacta enseguida 👍'
        })
      } else {
        await sock.sendMessage(from, { text: respuesta })
      }
    } catch(e) {
      console.error('Error:', e.message)
      await sock.sendMessage(from, {
        text: 'Hubo un problema, intenta de nuevo en un momento 🙏'
      })
    }
  })
}

// ============================================================
// SERVIDOR HTTP — muestra el QR en el navegador
// ============================================================
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html')
  if (botConectado) {
    res.end('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;margin:0"><h2 style="color:#4caf50;font-family:sans-serif">✅ Bot conectado y activo</h2></body></html>')
  } else if (qrImageUrl) {
    res.end(`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;margin:0;font-family:sans-serif;color:#fff">
      <h2>📱 Escanea con WhatsApp Business</h2>
      <img src="${qrImageUrl}" style="width:280px;height:280px;border-radius:12px"/>
      <p style="color:#aaa;margin-top:16px">Recarga esta página si el QR expiró</p>
    </body></html>`)
  } else {
    res.end('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;margin:0"><h2 style="color:#fff;font-family:sans-serif">⏳ Generando QR... recarga en 5 segundos</h2></body></html>')
  }
}).listen(3000, () => {
  console.log('🌐 Servidor HTTP en puerto 3000')
})

getTasa()
setInterval(getTasa, 30 * 60 * 1000)
iniciar()
      const reconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (reconectar) {
        console.log('🔄 Reconectando...')
        iniciar()
      } else {
        console.log('❌ Sesión cerrada. Abre la URL de Render para escanear el QR.')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    if (from === 'status@broadcast') return
    
    const texto = msg.message.conversation || 
                  msg.message.extendedTextMessage?.text || ''
    if (!texto.trim()) return

    if (!historiales[from]) historiales[from] = []
    
    try {
      await sock.sendPresenceUpdate('composing', from)
      const respuesta = await responder(texto, historiales[from])
      
      historiales[from].push({ role: 'user', content: texto })
      historiales[from].push({ role: 'assistant', content: respuesta })
      
      // Limitar historial a últimos 10 mensajes
      if (historiales[from].length > 20) {
        historiales[from] = historiales[from].slice(-20)
      }

      if (respuesta.includes('ESCALAR')) {
        await sock.sendMessage(OWNER, { 
          text: \`🚨 *Cliente necesita atención*\\nNúmero: \${from}\\nPreguntó: "\${texto}"\` 
        })
        await sock.sendMessage(from, { 
          text: 'Esa pregunta la responde el dueño directamente, te contacta enseguida 👍' 
        })
      } else {
        await sock.sendMessage(from, { text: respuesta })
      }
    } catch(e) {
      console.error('Error:', e.message)
      await sock.sendMessage(from, { 
        text: 'Hubo un problema, intenta de nuevo en un momento 🙏' 
      })
    }
  })
}

// Servidor HTTP — muestra el QR en el navegador para poder escanearlo
http.createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html')
  if (botConectado) {
    res.end('<h2 style="font-family:sans-serif;text-align:center;margin-top:100px">✅ Bot conectado y activo</h2>')
  } else if (qrImageUrl) {
    res.end(\`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#111;color:#fff">
      <h2>📱 Escanea con WhatsApp Business</h2>
      <img src="\${qrImageUrl}" style="width:280px;height:280px"/>
      <p style="color:#aaa">Recarga esta página si el QR expiró</p>
    </body></html>\`)
  } else {
    res.end('<h2 style="font-family:sans-serif;text-align:center;margin-top:100px;color:#fff;background:#111;height:100vh;margin:0;display:flex;align-items:center;justify-content:center">⏳ Generando QR... recarga en 5 segundos</h2>')
  }
}).listen(3000, () => {
  console.log('🌐 Servidor HTTP en puerto 3000 — abre tu URL de Render para ver el QR')
})

getTasa()
setInterval(getTasa, 30 * 60 * 1000)
iniciar()`
  }
};

const steps = [
  { n: 1, title: "Crea el Repl", desc: "Entra a replit.com → New Repl → Node.js → ponle nombre \"bot-almacen\"" },
  { n: 2, title: "Crea los 3 archivos", desc: "En Replit crea package.json, .env e index.js con el código de abajo" },
  { n: 3, title: "Pon tus claves en .env", desc: "Tu key de Groq (groq.com), tu token de elToque, y tu número de WhatsApp" },
  { n: 4, title: "Instala dependencias", desc: "En la consola de Replit escribe: npm install" },
  { n: 5, title: "Corre el bot", desc: "Escribe: node index.js — aparece un QR, escanéalo con tu WhatsApp Business" },
  { n: 6, title: "Configura UptimeRobot", desc: "En uptimerobot.com crea un monitor HTTP con la URL de tu Repl para que no se duerma" },
];

export default function BotGuide() {
  const [activeFile, setActiveFile] = useState("package.json");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(files[activeFile].content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0d1117",
      color: "#e6edf3",
      fontFamily: "'Courier New', monospace",
      padding: "16px",
    }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid #21262d",
        paddingBottom: "16px",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <span style={{ fontSize: "24px" }}>🤖</span>
          <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#58a6ff" }}>
            Bot WhatsApp — Almacén
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: "12px", color: "#8b949e" }}>
          Groq + Baileys + elToque API · Costo: $0
        </p>
      </div>

      {/* Steps */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "13px", color: "#8b949e", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "1px" }}>
          Pasos
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {steps.map(s => (
            <div key={s.n} style={{
              display: "flex", gap: "12px", alignItems: "flex-start",
              background: "#161b22", borderRadius: "8px",
              padding: "10px 12px", border: "1px solid #21262d"
            }}>
              <div style={{
                width: "22px", height: "22px", borderRadius: "50%",
                background: "#1f6feb", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: "11px", fontWeight: "700",
                flexShrink: 0, marginTop: "1px"
              }}>{s.n}</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#e6edf3", marginBottom: "2px" }}>
                  {s.title}
                </div>
                <div style={{ fontSize: "12px", color: "#8b949e", lineHeight: "1.4" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Files */}
      <div>
        <h2 style={{ fontSize: "13px", color: "#8b949e", margin: "0 0 12px", textTransform: "uppercase", letterSpacing: "1px" }}>
          Archivos
        </h2>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "0", flexWrap: "wrap" }}>
          {Object.keys(files).map(name => (
            <button key={name} onClick={() => { setActiveFile(name); setCopied(false); }} style={{
              padding: "7px 14px",
              background: activeFile === name ? "#161b22" : "transparent",
              border: activeFile === name ? "1px solid #30363d" : "1px solid transparent",
              borderBottom: activeFile === name ? "1px solid #161b22" : "1px solid transparent",
              borderRadius: "6px 6px 0 0",
              color: activeFile === name ? "#e6edf3" : "#8b949e",
              cursor: "pointer",
              fontSize: "13px",
              fontFamily: "'Courier New', monospace",
              marginBottom: "-1px",
              position: "relative",
              zIndex: activeFile === name ? 1 : 0,
            }}>
              {files[name].icon} {name}
            </button>
          ))}
        </div>

        {/* Code box */}
        <div style={{
          background: "#161b22",
          border: "1px solid #30363d",
          borderRadius: "0 6px 6px 6px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Copy button */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 14px",
            borderBottom: "1px solid #21262d",
            background: "#161b22",
          }}>
            <span style={{ fontSize: "11px", color: "#8b949e" }}>
              {activeFile === ".env" ? "⚠️ Rellena con tus datos reales" : `Copia todo el contenido`}
            </span>
            <button onClick={handleCopy} style={{
              padding: "5px 14px",
              background: copied ? "#238636" : "#21262d",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: copied ? "#fff" : "#8b949e",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              transition: "all 0.2s",
            }}>
              {copied ? "✅ Copiado" : "📋 Copiar"}
            </button>
          </div>

          <pre style={{
            margin: 0,
            padding: "14px",
            fontSize: "11px",
            lineHeight: "1.6",
            overflowX: "auto",
            overflowY: "auto",
            maxHeight: "420px",
            color: activeFile === ".env" ? "#ffa657" : "#e6edf3",
            whiteSpace: "pre",
          }}>
            {files[activeFile].content}
          </pre>
        </div>

        {/* File-specific notes */}
        {activeFile === ".env" && (
          <div style={{
            marginTop: "10px", padding: "12px",
            background: "#1c2128", border: "1px solid #d29922",
            borderRadius: "6px", fontSize: "12px", color: "#d29922",
            lineHeight: "1.6"
          }}>
            🔑 <strong>Dónde conseguir las claves:</strong><br/>
            • <strong>GROQ_API_KEY</strong>: groq.com → Sign In con GitHub → API Keys → Create<br/>
            • <strong>ELTOQUE_TOKEN</strong>: déjalo vacío por ahora, te lo aprueban en unos días<br/>
            • <strong>TASA_MANUAL</strong>: pon el toque actual (ej: 385). Cámbiala cuando suba o baje<br/>
            • <strong>OWNER_NUMBER</strong>: tu número sin + ni espacios (ej: 5353123456)<br/><br/>
            ✅ Cuando llegue el token de elToque, pégalo en ELTOQUE_TOKEN y listo — la tasa se actualiza sola
          </div>
        )}

        {activeFile === "index.js" && (
          <div style={{
            marginTop: "10px", padding: "12px",
           - Wafer RULIX 45g: 125 CUP (cajas x24 u)
- Wafer MARDAN 30g: 95.84 CUP (cajas x24 u)
- Malvaviscos 30g: 116.67 CUP (cajas x24 u)
- Wafer 77 XXL: 137 CUP (cajas x24 u)
- Refresco Bien Fría (limón, naranja, manzana): 240 CUP
- Pasta tomate 850g: 650 CUP (cajas x12 u)
- Cerveza Bien Fría 5%: 260 CUP
- Galletas LOLA (paquetes x12): 66.77 CUP
- Espagueti 500g: 240 CUP

=== ALMACÉN 5 / 5.1 / 5.2 ===
- Pollo Muslo caja (4 pqts 40lb): 17700 CUP o 30.5 USD
- Lomo deshuesado: 1200 CUP/lb o 2.05 USD/lb
- Leche Evaporada caja x24: 15100 CUP (650 CUP/lata)
- Mayonesa Nezka 494ml caja x12: 10500 CUP (875 CUP/u)
- Masa de cerdo deshuesada: 1150 CUP/lb o 2.00 USD/lb
- Café Nezka 250g caja x20: 32800 CUP (1640 CUP/u) [5.1] / 31900 CUP (1595 CUP/u) [5.2]
- Chupa Chupa caja x16pqts x24u: 15360 CUP (960 CUP/pqt, 40 CUP/u)
- Huevo caja x12: 31200 CUP (2600 CUP/u)
- Batería Bluetti 2304 Wh: 1500 USD
- Batería Bluetti 1152 Wh: 680 USD
- Batería Bluetti 1024 Wh: 770 USD

=== ALMACÉN 6 (+15 encima del toque) ===
- Papitas Pan Pan 35g: 0.46 USD (sabores: tomate, BBQ, queso, picante) — disponible sábado
- Arroz brasileño 1kg: 1.06 USD (pacas x30 u)
- Galleta María 90g: 0.32 USD (+1 caja) | 0.30 USD (+100 cajas)
- Wafer MARDAN 30g: 0.14 USD (+1 caja) | 0.13 USD (+20 cajas)
- Wafer RULIX 45g: 0.20 USD (+1 caja) | 0.19 USD (+20 cajas)
- Malvavisco 30g: 0.17 USD (caja x144 u)
- Refresco (manzana, naranja, limón): 0.41 USD (+1 caja) | 0.40 USD (+100 cajas)
- Spaghetti 500g: 0.38 USD
- Pasta tomate 850g: 1.12 USD (+1 caja) | 1.10 USD (+50 cajas)
- Leche en polvo 200g: 1.48 USD (x48 u)
Confituras (disponibles martes):
  - Peter Jimmy 40g Chocolate: 0.25 USD/u (cajas x144)
  - Peter Jimmy 20g: 0.13 USD/u (cajas x144)
  - Bombones 500g: 3.50 USD/bolsa (cajas x16 bolsas)
  - Bombones 250g: 1.75 USD/bolsa
  - Jimmy Cornet 25g: 0.26 USD/u
  - Peter Crash 40g: 0.23 USD/u
  - Peter Orient 80g (almendras/chocolate/avellanas/leche): 0.47 USD/u
  - Nutella y Palitos 52g: 0.53 USD/u
  - Peter Maxtat 30g: 0.175 USD/u
  - Caramelos 170g: 1.00 USD/bolsa | Caramelos 90g: 0.60 USD/bolsa
  - Jimmy Toys 25g: 0.46 USD/u

=== ALMACÉN 7 ===
- Sopitas pollo 70g: 170 CUP (cajas x40 u)
- Leche condensada Tánamo: 500 CUP
- Café Ziva: 1700 CUP (cajas x20 u)
- Arroz 1kg: 570 CUP (cajas x30 u)
- Huevo: 2600 CUP (cajas x12 files)
- Galletas Crokantina 7 tacos: 1200 CUP (caja x24 u)

=== ALMACÉN 7.1 ===
- Jugo 200ml: 145 CUP (mango, piña, frambuesa, cóctel, albaricoque)
- Leche condensada La Granjera: 500 CUP (caja x24 u)
- Pasta tomate Castellun 400g: 370 CUP
- Huevo: 2600 CUP (cajas x12 files)

=== ALMACÉN 22 (+20 CUP encima del toque) ===
- Azúcar 1kg paca x10: 1.30 USD (+1 paca) | 1.29 USD (+300 pacas)
- Arroz brasileño 1kg: 1.05 USD
- Hamburguesas res 75g: 240 CUP (caj x40 u)
- Molleja 1kg: 2.36 USD (caja x10 u) | 2.00 USD (+100 cajas)
- Pomo agua 500ml: 0.27 USD
- Energizante Go+ caja x24: 0.50 USD
- Jugos varios sabores: 0.30 USD
- Detergente YAMY 500g: 0.67 USD (paca x25 u)
- Arroz 1kg paca x30: 1.20 USD/u
- Frijol negro 1kg paca x30: 1.30 USD/u
- Frijol negro 25kg: 31.5 USD
- Atún 140g: 0.80 USD (+1 caja) | 0.73 USD (+150 cajas)
- Mostaza 320ml: 1.98 USD (caja x24 u)
- Ketchup 320g: 1.75 USD (caja x24 u)
- Pasta tomate VIMA 3kg: 8.66 USD (caja x6 u)
- Coffee Mate: 4.00 USD (caja x24 u)
- Mayonesa casera 450g: 3.61 USD (caja x24 u)
- Salsa cóctel 225g: 1.58 USD
- Galleta ALDIVA elegance 60g: 0.38 USD (x24 u)
- Mantequilla 225g: 2.45 USD (caj x40 u)
Ron Santiago (caja x12 botellas):
  - Carta Blanca: 6.90 USD
  - Añejo Tradición: 9.50 USD
  - Añejo 8 años: 10.30 USD
  - Extra 11 años: 18.95 USD
  - Extra 12 años: 21.95 USD
  - Super Dry: 3.93 USD
  - Aguardiente: 3.54 USD
  - Ron Orange: 5.45 USD

=== ALMACÉN 21 ===
- Zumo de limón: 250 CUP (blíster x15 u = 3750 CUP)
- Miel 400ml: 430 CUP (x24 = 10320 CUP)
- Detergente Silver Bright 500g: 420 CUP (paca x20)
- Detergente Silver Bright 900g: 630 CUP (paca x15)
- Mayonesa Saude: 760 CUP (x12 = 9120 CUP)
- Espaguetis 500g: 240 CUP (x20 = 4800 CUP)
- Compotas BabyFruit (durazno, frutas mixtas): 290 CUP (x24 = 6960 CUP)
- Galletas Romo: 140 CUP (x24 = 3360 CUP)
- Galletas Browni (chocolate, naranja, vainilla): 133 CUP (x24 = 3192 CUP)
- Pasta tomate 850g: 740 CUP (x12 = 8880 CUP)
- Galletas Hola (chocolate, vainilla): 160 CUP (x24 = 3840 CUP)
- Leche Condensada Holland Park: 509 CUP (x24 = 12216 CUP)
- Frijol negro 1kg paca x30: 755 CUP (paca = 22650 CUP)
- Saco arroz 50kg: 29620 CUP
- Mayonesa Celorrio: 1630 CUP (x12 = 19560 CUP)
- Mayonesa HollandPark: 860 CUP (x12 = 10320 CUP)
- Vinagre Claro: 280 CUP (x15 = 4200 CUP)
- Vino Seco: 280 CUP (x15 = 4200 CUP)
- Leche Evaporada Nezka: 685 CUP (x24 = 16440 CUP)
- Gelatina 35g (fresa, uva, piña, naranja): 235 CUP (x48 = 11280 CUP)
- Cerveza Eichbaum: 248 CUP (caja x24 = 5952 CUP)
- Atún 140g: 425 CUP (x48 = 20400 CUP)
- Jamonilla cerdo y pollo: 760 CUP (x24 = 18240 CUP)
- Palomitas: 320 CUP (x32 = 10240 CUP)
Aceite motor (compra +1000 USD):
  - 20w50 5lt semisintético: 20 USD
  - 15w40 5lt semisintético: 20 USD
  - 10w40 5lt sintético: 20 USD
  - 5w30 5lt sintético: 22 USD
  - Pomo 20L 20w50 semisintético: 70 USD
`

// ============================================================
// TASA USD (se actualiza automático cada 30 minutos)
// ============================================================
let tasaUSD = 385

async function getTasa() {
  try {
    const { data } = await axios.get('https://tasas.eltoque.com/v1/trmi', {
      headers: { 'Authorization': `Bearer ${process.env.ELTOQUE_TOKEN}` }
    })
    if (data && data.USD) {
      tasaUSD = data.USD
      console.log(`💱 Tasa actualizada: ${tasaUSD} CUP/USD`)
    }
  } catch(e) {
    console.log('⚠️  No se pudo actualizar la tasa, usando:', tasaUSD)
  }
}

// ============================================================
// GROQ — cerebro del bot
// ============================================================
async function responder(mensaje, historial) {
  const sistema = `Eres el asistente de ventas de un almacén mayorista en Cuba. Atiendes por WhatsApp.

💱 Tasa USD hoy: ${tasaUSD} CUP (fuente: elToque - mercado informal)

Recargos por almacén sobre el toque:
- Almacén 19: toque + 10 CUP por USD
- Almacén 18: toque + 15 CUP por USD  
- Almacén 6: toque + 15 CUP por USD
- Almacén 22: toque + 20 CUP por USD

CATÁLOGO:
${CATALOGO}

INSTRUCCIONES:
1. Responde preguntas de precios y disponibilidad buscando en el catálogo
2. Cuando des precios en USD también di el equivalente en CUP con la tasa del día
3. Para cerrar un pedido necesitas recoger: nombre del cliente, qué producto y cuánto, forma de pago (efectivo USD, efectivo CUP o transferencia), dirección de entrega
4. Si no encuentras el producto o no puedes responder algo, escribe exactamente la palabra: ESCALAR
5. Sé amable, responde corto y usa pocos emojis
6. Habla natural como en Cuba, tutéalo al cliente`

  const resp = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: sistema },
      ...historial,
      { role: 'user', content: mensaje }
    ],
    max_tokens: 600,
    temperature: 0.5
  })
  return resp.choices[0].message.content
}

// ============================================================
// WHATSAPP
// ============================================================
const historiales = {}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: pino({ level: 'silent' })
  })
  
  sock.ev.on('creds.update', saveCreds)
  
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') console.log('✅ WhatsApp conectado!')
    if (connection === 'close') {
      const reconectar = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut
      if (reconectar) {
        console.log('🔄 Reconectando...')
        iniciar()
      } else {
        console.log('❌ Sesión cerrada. Escanea el QR de nuevo.')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return
    const from = msg.key.remoteJid
    if (from === 'status@broadcast') return
    
    const texto = msg.message.conversation || 
                  msg.message.extendedTextMessage?.text || ''
    if (!texto.trim()) return

    if (!historiales[from]) historiales[from] = []
    
    try {
      await sock.sendPresenceUpdate('composing', from)
      const respuesta = await responder(texto, historiales[from])
      
      historiales[from].push({ role: 'user', content: texto })
      historiales[from].push({ role: 'assistant', content: respuesta })
      
      // Limitar historial a últimos 10 mensajes
      if (historiales[from].length > 20) {
        historiales[from] = historiales[from].slice(-20)
      }

      if (respuesta.includes('ESCALAR')) {
        await sock.sendMessage(OWNER, { 
          text: `🚨 *Cliente necesita atención*\nNúmero: ${from}\nPreguntó: "${texto}"` 
        })
        await sock.sendMessage(from, { 
          text: 'Esa pregunta la responde el dueño directamente, te contacta enseguida 👍' 
        })
      } else {
        await sock.sendMessage(from, { text: respuesta })
      }
    } catch(e) {
      console.error('Error:', e.message)
      await sock.sendMessage(from, { 
        text: 'Hubo un problema, intenta de nuevo en un momento 🙏' 
      })
    }
  })
}

// Servidor HTTP para que UptimeRobot lo pinee y Replit no duerma
http.createServer((_, res) => res.end('Bot activo ✅')).listen(3000, () => {
  console.log('🌐 Servidor HTTP en puerto 3000')
})

getTasa()
setInterval(getTasa, 30 * 60 * 1000)
iniciar()
