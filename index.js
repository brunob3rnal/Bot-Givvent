import dotenv from 'dotenv';
dotenv.config();

import pkg from '@whiskeysockets/baileys';
import axios from 'axios';
import http from 'http';
import pino from 'pino';
import QRCode from 'qrcode';
import Groq from 'groq-sdk';

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
} = pkg;

const PORT = Number(process.env.PORT || 3000);
const OWNER = process.env.OWNER_NUMBER ? `${process.env.OWNER_NUMBER}@s.whatsapp.net` : null;
const BOT_NAME = process.env.BOT_NAME || 'Bot-Givvent';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const GROC_TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 30000);
const REPLY_TIMEOUT_MS = Number(process.env.REPLY_TIMEOUT_MS || 45000);
const ENABLE_SELF_TEST = String(process.env.BOT_SELF_TEST || '0') === '1';

const groqApiKey = process.env.GROQ_API_KEY || '';
const groq = new Groq({ apiKey: groqApiKey });

let qrImageUrl = null;
let botConectado = false;
let isRestarting = false;
let tasaUSD = parseInt(process.env.TASA_MANUAL || '385', 10) || 385;
let sockGlobal = null;

const CATALOGO = ` === ALMACÉN 19 (+10 CUP encima del toque) ===

Cerveza Coprove: 0.49 USD (cajas x24 u)

Jugo de lata Sunchy: 0.54 USD mínimo 1 caja (cajas x24 u) sabores: Banana, Tamarindo, Guayaba, Pera, Mango

Refresco Ironbeer: 0.54 USD (cajas x24 u)

Refresco Piñita: 0.54 USD mínimo 10 cajas (cajas x24 u)

Cemento Chagres 42.5 kg: 22 USD

Caja Porcelanato 1.44m (4 losas 60x60): 30 USD


=== ALMACÉN 18 (+15 CUP encima del toque) === Huevo Perla:

Blanco: 4.3 USD efectivo | 2632.5 CUP transferencia

Marrón: 4.2 USD efectivo | 2632.5 CUP transferencia Arroz saco 50kg:

Por saco: 47 USD efectivo | por contenedor: 45 USD efectivo

Transferencia: 52 USD equivalente Aceite Semilla: 2.10 USD x contenedor | 2.15 USD x unidad/caja Frijoles negros saco 50kg: 58 USD Leche condensada: 519 CUP (0.90 USD) por lata


=== ALMACÉN 20 (mensajería: 56237509) ===

Galletas María 90g: 190 CUP (cajas x24 u)

Souffle 30g: 116.67 CUP (cajas x24 u)

Wafer RULIX 45g: 125 CUP (cajas x24 u)

Wafer MARDAN 30g: 95.84 CUP (cajas x24 u)

Malvaviscos 30g: 116.67 CUP (cajas x24 u)

Wafer 77 XXL: 137 CUP (cajas x24 u)

Refresco Bien Fría (limón, naranja, manzana): 240 CUP

Pasta tomate 850g: 650 CUP (cajas x12 u)

Cerveza Bien Fría 5%: 260 CUP

Galletas LOLA (paquetes x12): 66.77 CUP

Espagueti 500g: 240 CUP


=== ALMACÉN 5 / 5.1 / 5.2 ===

Pollo Muslo caja (4 pqts 40lb): 17700 CUP o 30.5 USD

Lomo deshuesado: 1200 CUP/lb o 2.05 USD/lb

Leche Evaporada caja x24: 15100 CUP (650 CUP/lata)

Mayonesa Nezka 494ml caja x12: 10500 CUP (875 CUP/u)

Masa de cerdo deshuesada: 1150 CUP/lb o 2.00 USD/lb

Café Nezka 250g caja x20: 32800 CUP [almacén 5.1] / 31900 CUP [almacén 5.2]

Chupa Chupa caja x16pqts x24u: 15360 CUP (960 CUP/pqt, 40 CUP/u)

Huevo caja x12: 31200 CUP (2600 CUP/u)

Batería Bluetti 2304 Wh: 1500 USD

Batería Bluetti 1152 Wh: 680 USD

Batería Bluetti 1024 Wh: 770 USD


=== ALMACÉN 6 (+15 encima del toque) ===

Papitas Pan Pan 35g: 0.46 USD (sabores: tomate, BBQ, queso, picante) disponible sábado

Arroz brasileño 1kg: 1.06 USD (pacas x30 u)

Galleta María 90g: 0.32 USD (+1 caja) | 0.30 USD (+100 cajas)

Wafer MARDAN 30g: 0.14 USD (+1 caja) | 0.13 USD (+20 cajas)

Wafer RULIX 45g: 0.20 USD (+1 caja) | 0.19 USD (+20 cajas)

Malvavisco 30g: 0.17 USD (caja x144 u)

Refresco (manzana, naranja, limón): 0.41 USD (+1 caja) | 0.40 USD (+100 cajas)

Spaghetti 500g: 0.38 USD

Pasta tomate 850g: 1.12 USD (+1 caja) | 1.10 USD (+50 cajas)

Leche en polvo 200g: 1.48 USD (x48 u) Confituras (disponibles martes):

Peter Jimmy 40g Chocolate: 0.25 USD/u

Peter Jimmy 20g: 0.13 USD/u

Bombones 500g: 3.50 USD/bolsa

Bombones 250g: 1.75 USD/bolsa

Jimmy Cornet 25g: 0.26 USD/u

Peter Crash 40g: 0.23 USD/u

Peter Orient 80g: 0.47 USD/u

Nutella y Palitos 52g: 0.53 USD/u

Peter Maxtat 30g: 0.175 USD/u

Caramelos 170g: 1.00 USD/bolsa | Caramelos 90g: 0.60 USD/bolsa

Jimmy Toys 25g: 0.46 USD/u



=== ALMACÉN 7 ===

Sopitas pollo 70g: 170 CUP (cajas x40 u)

Leche condensada Tánamo: 500 CUP

Café Ziva: 1700 CUP (cajas x20 u)

Arroz 1kg: 570 CUP (cajas x30 u)

Huevo: 2600 CUP (cajas x12 files)

Galletas Crokantina 7 tacos: 1200 CUP (caja x24 u)


=== ALMACÉN 7.1 ===

Jugo 200ml: 145 CUP (mango, piña, frambuesa, cóctel, albaricoque)

Leche condensada La Granjera: 500 CUP (caja x24 u)

Pasta tomate Castellun 400g: 370 CUP

Huevo: 2600 CUP (cajas x12 files)


=== ALMACÉN 22 (+20 CUP encima del toque) ===

Azúcar 1kg paca x10: 1.30 USD (+1 paca) | 1.29 USD (+300 pacas)

Arroz brasileño 1kg: 1.05 USD

Hamburguesas res 75g: 240 CUP (caj x40 u)

Molleja 1kg: 2.36 USD (caja x10 u) | 2.00 USD (+100 cajas)

Pomo agua 500ml: 0.27 USD

Energizante Go+ caja x24: 0.50 USD

Jugos varios sabores: 0.30 USD

Detergente YAMY 500g: 0.67 USD (paca x25 u)

Arroz 1kg paca x30: 1.20 USD/u

Frijol negro 1kg paca x30: 1.30 USD/u

Frijol negro 25kg: 31.5 USD

Atún 140g: 0.80 USD (+1 caja) | 0.73 USD (+150 cajas)

Mostaza 320ml: 1.98 USD (caja x24 u)

Ketchup 320g: 1.75 USD (caja x24 u)

Pasta tomate VIMA 3kg: 8.66 USD (caja x6 u)

Coffee Mate: 4.00 USD (caja x24 u)

Mayonesa casera 450g: 3.61 USD (caja x24 u)

Salsa cóctel 225g: 1.58 USD

Galleta ALDIVA elegance 60g: 0.38 USD (x24 u)

Mantequilla 225g: 2.45 USD (caj x40 u) Ron Santiago (caja x12 botellas):

Carta Blanca: 6.90 USD

Añejo Tradición: 9.50 USD

Añejo 8 años: 10.30 USD

Extra 11 años: 18.95 USD

Extra 12 años: 21.95 USD

Super Dry: 3.93 USD

Aguardiente: 3.54 USD

Ron Orange: 5.45 USD



=== ALMACÉN 21 ===

Zumo de limón: 250 CUP (blíster x15 u)

Miel 400ml: 430 CUP

Detergente Silver Bright 500g: 420 CUP (paca x20)

Detergente Silver Bright 900g: 630 CUP (paca x15)

Mayonesa Saude: 760 CUP (x12)

Espaguetis 500g: 240 CUP (x20)

Compotas BabyFruit (durazno, frutas mixtas): 290 CUP (x24)

Galletas Romo: 140 CUP (x24)

Galletas Browni (chocolate, naranja, vainilla): 133 CUP (x24)

Pasta tomate 850g: 740 CUP (x12)

Galletas Hola (chocolate, vainilla): 160 CUP (x24)

Leche Condensada Holland Park: 509 CUP (x24)

Frijol negro 1kg paca x30: 755 CUP/u

Saco arroz 50kg: 29620 CUP

Mayonesa Celorrio: 1630 CUP (x12)

Mayonesa HollandPark: 860 CUP (x12)

Leche Evaporada Nezka: 685 CUP (x24)

Gelatina 35g (fresa, uva, piña, naranja): 235 CUP (x48)

Cerveza Eichbaum: 248 CUP (caja x24)

Atún 140g: 425 CUP (x48)

Jamonilla cerdo y pollo: 760 CUP (x24)

Palomitas: 320 CUP (x32)

Aceite motor (compra +1000 USD):

20w50 5lt semisintético: 20 USD

15w40 5lt semisintético: 20 USD

10w40 5lt sintético: 20 USD

5w30 5lt sintético: 22 USD

Pomo 20L semisintético: 70 USD `;

const historiales = Object.create(null);

function logStartup() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Iniciando ${BOT_NAME}`);
  console.log(`🧩 Node env: ${process.env.NODE_ENV || 'no definido'}`);
  console.log(`🌐 Puerto: ${PORT}`);
  console.log(`🤖 Modelo Groq: ${GROQ_MODEL}`);
  console.log(`💱 Tasa manual inicial: ${tasaUSD} CUP/USD`);
  console.log(`👤 OWNER: ${OWNER || 'NO DEFINIDO'}`);
  console.log(`🔑 GROQ_API_KEY: ${groqApiKey ? 'OK' : 'NO DEFINIDA'}`);
  console.log(`🧪 Self-test: ${ENABLE_SELF_TEST ? 'ACTIVADO' : 'DESACTIVADO'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

function warnIfMissingEnv() {
  const missing = [];
  if (!groqApiKey) missing.push('GROQ_API_KEY');
  if (!OWNER) missing.push('OWNER_NUMBER');
  if (!process.env.TASA_MANUAL && !process.env.ELTOQUE_TOKEN) missing.push('TASA_MANUAL o ELTOQUE_TOKEN');

  if (missing.length) {
    console.log('⚠️  Variables faltantes:', missing.join(', '));
  }
}

function safePreview(text, limit = 120) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

function formatError(e) {
  if (!e) return 'Error desconocido';
  if (e instanceof Error) return `${e.name}: ${e.message}`;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function extractText(message) {
  if (!message) return '';

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.ephemeralMessage?.message?.conversation ||
    message.ephemeralMessage?.message?.extendedTextMessage?.text ||
    message.viewOnceMessage?.message?.conversation ||
    message.viewOnceMessage?.message?.extendedTextMessage?.text ||
    message.viewOnceMessageV2?.message?.conversation ||
    message.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
    ''
  );
}

function getMessageType(message) {
  if (!message) return 'sin mensaje';
  return Object.keys(message).join(',');
}

async function getTasa() {
  if (!process.env.ELTOQUE_TOKEN) {
    tasaUSD = parseInt(process.env.TASA_MANUAL || String(tasaUSD), 10) || tasaUSD;
    console.log(`💱 Tasa manual: ${tasaUSD} CUP/USD`);
    return tasaUSD;
  }

  try {
    console.log('💱 Consultando tasa en elToque...');
    const { data } = await axios.get('https://tasas.eltoque.com/v1/trmi', {
      headers: { Authorization: `Bearer ${process.env.ELTOQUE_TOKEN}` },
      timeout: 15000,
    });

    if (data && data.USD) {
      tasaUSD = Number(data.USD);
      console.log(`💱 Tasa elToque: ${tasaUSD} CUP/USD`);
    } else {
      console.log('⚠️  elToque respondió sin USD, sigo con:', tasaUSD);
    }
  } catch (e) {
    console.log('⚠️  Error consultando elToque, usando manual:', formatError(e));
  }

  return tasaUSD;
}

function withTimeout(promise, ms, label = 'operación') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout en ${label} (${ms} ms)`)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function responder(mensaje, historial) {
  const sistema = `Eres el asistente de ventas de un almacén mayorista en Cuba. Atiendes por WhatsApp.

💱 Tasa USD hoy: ${tasaUSD} CUP (fuente: elToque - mercado informal)

Recargos por almacén sobre el toque:

Almacén 19: toque + 10 CUP por USD

Almacén 18: toque + 15 CUP por USD

Almacén 6: toque + 15 CUP por USD

Almacén 22: toque + 20 CUP por USD


CATÁLOGO: ${CATALOGO}

INSTRUCCIONES:

1. Responde preguntas de precios y disponibilidad buscando en el catálogo.


2. Cuando des precios en USD también di el equivalente en CUP con la tasa del día.


3. Para cerrar un pedido necesitas: nombre del cliente, producto y cantidad, forma de pago (efectivo USD, efectivo CUP o transferencia), dirección.


4. Si no encuentras el producto o no puedes responder algo, escribe exactamente: ESCALAR.


5. Sé amable, responde corto y usa pocos emojis.


6. Habla natural como en Cuba, tutéalo al cliente.`;

  console.log('🤖 Llamando a Groq...');
  const resp = await withTimeout(
    groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: sistema },
        ...historial,
        { role: 'user', content: mensaje },
      ],
      max_tokens: 600,
      temperature: 0.5,
    }),
    GROC_TIMEOUT_MS,
    'Groq'
  );

  const content = resp?.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('Groq respondió vacío');
  }

  return content;
}

async function sendText(sock, jid, text) {
  console.log(`📤 Enviando mensaje a ${jid}: ${safePreview(text)}`);
  await withTimeout(sock.sendMessage(jid, { text }), REPLY_TIMEOUT_MS, 'sendMessage');
  console.log('✅ Mensaje enviado');
}

async function processIncomingMessage(sock, msg) {
  const from = msg?.key?.remoteJid;
  const fromMe = !!msg?.key?.fromMe;
  const message = msg?.message;

  console.log('📨 fromMe:', fromMe, '| from:', from || 'sin jid', '| tiene mensaje:', !!message);

  if (!message || fromMe) return;
  if (!from || from === 'status@broadcast') return;

  console.log('🔍 Tipo de mensaje:', getMessageType(message));

  const texto = extractText(message);
  console.log('📝 Texto extraído:', safePreview(texto, 200));
  if (!texto.trim()) return;

  if (!historiales[from]) historiales[from] = [];

  try {
    console.log('🚀 Entrando al flujo de respuesta para:', from);
    await sock.sendPresenceUpdate('composing', from);

    // Prueba rápida de aislamiento: si activas BOT_DRY_RUN=1, responde sin IA.
    const dryRun = String(process.env.BOT_DRY_RUN || '0') === '1';
    const respuesta = dryRun ? 'Prueba funcionando.' : await responder(texto, historiales[from]);

    console.log('🤖 Respuesta generada:', safePreview(respuesta, 240));

    historiales[from].push({ role: 'user', content: texto });
    historiales[from].push({ role: 'assistant', content: respuesta });

    if (historiales[from].length > 20) {
      historiales[from] = historiales[from].slice(-20);
    }

    if (/^ESCALAR$/i.test(respuesta.trim())) {
      if (OWNER) {
        await sendText(sock, OWNER, `🚨 *Cliente necesita atención*\nNúmero: ${from}\nPreguntó: "${texto}"`);
      } else {
        console.log('⚠️  OWNER no definido, no se pudo avisar al dueño');
      }

      await sendText(sock, from, 'Esa pregunta la responde el dueño directamente, te contacta enseguida 👍');
      return;
    }

    await sendText(sock, from, respuesta);
  } catch (e) {
    console.error('❌ Error en el flujo del mensaje:');
    console.error(e);

    try {
      await sendText(sock, from, 'Hubo un problema, intenta de nuevo en un momento 🙏');
    } catch (sendError) {
      console.error('❌ No se pudo enviar mensaje de error al cliente:');
      console.error(sendError);
    }
  }
}

async function iniciar() {
  if (isRestarting) {
    console.log('🔄 Ya hay un reinicio en curso, salto esta llamada');
    return;
  }

  isRestarting = true;
  try {
    console.log('🔐 Cargando estado de autenticación...');
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const version = await fetchLatestBaileysVersion().catch(() => null);

    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: 'silent' }),
      version: version?.version,
      printQRInTerminal: false,
    });

    sockGlobal = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        try {
          qrImageUrl = await QRCode.toDataURL(qr);
          botConectado = false;
          console.log('📱 QR generado — abre tu URL de Render para escanearlo');
        } catch (e) {
          console.error('❌ No se pudo generar el QR:');
          console.error(e);
        }
      }

      if (connection === 'open') {
        botConectado = true;
        qrImageUrl = null;
        console.log('✅ WhatsApp conectado!');

        if (ENABLE_SELF_TEST) {
          console.log('🧪 Self-test activo: probando respuesta local sin enviar mensaje');
          try {
            const prueba = await responder('tienen arroz?', []);
            console.log('🧪 Self-test Groq OK:', safePreview(prueba, 200));
          } catch (e) {
            console.error('🧪 Self-test falló:');
            console.error(e);
          }
        }
      }

      if (connection === 'close') {
        botConectado = false;
        const codigo = lastDisconnect?.error?.output?.statusCode;
        const errorTexto = lastDisconnect?.error?.message || formatError(lastDisconnect?.error);
        console.log('❌ Desconectado. Código:', codigo, '| Error:', errorTexto);

        const reconectar = codigo !== DisconnectReason.loggedOut;
        if (reconectar) {
          console.log('🔄 Reconectando...');
          isRestarting = false;
          setTimeout(() => {
            iniciar().catch(err => {
              console.error('❌ Falló el reinicio:');
              console.error(err);
            });
          }, 1500);
          return;
        }

        console.log('❌ Sesión cerrada.');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log('📨 Evento recibido, tipo:', type);
      if (type !== 'notify') return;
      const msg = messages?.[0];
      if (!msg) {
        console.log('⚠️  Evento notify sin mensaje');
        return;
      }
      await processIncomingMessage(sock, msg);
    });

    console.log('✅ Escuchando eventos de WhatsApp');
  } catch (e) {
    console.error('❌ Error iniciando el bot:');
    console.error(e);
  } finally {
    isRestarting = false;
  }
}

function renderPage() {
  if (botConectado) {
    return '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;margin:0"><h2 style="color:#4caf50;font-family:sans-serif">✅ Bot conectado y activo</h2></body></html>';
  }

  if (qrImageUrl) {
    return `<html><head><meta charset="utf-8"></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#111;margin:0;font-family:sans-serif;color:#fff"> <h2>📱 Escanea con WhatsApp Business</h2> <img src="${qrImageUrl}" style="width:280px;height:280px;border-radius:12px"/> <p style="color:#aaa;margin-top:16px">Recarga esta página si el QR expiró</p> </body></html>`;
  }

  return '<html><head><meta charset="utf-8"></head><body style="display:flex;align-items:center;justify-content:center;height:100vh;background:#111;margin:0"><h2 style="color:#fff;font-family:sans-serif">⏳ Generando QR... recarga en 5 segundos</h2></body></html>';
}

http.createServer((req, res) => {
  if (req.url === '/health') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      ok: true,
      botConectado,
      hasQr: !!qrImageUrl,
      ownerConfigured: !!OWNER,
      groqConfigured: !!groqApiKey,
      tasaUSD,
    }));
    return;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(renderPage());
}).listen(PORT, () => {
  logStartup();
  warnIfMissingEnv();
  console.log(`🌐 Servidor HTTP en puerto ${PORT}`);
  getTasa();
  setInterval(getTasa, 30 * 60 * 1000);
  iniciar();
});

process.on('unhandledRejection', err => {
  console.error('❌ unhandledRejection:');
  console.error(err);
});

process.on('uncaughtException', err => {
  console.error('❌ uncaughtException:');
  console.error(err);
});
