import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Server-side Gemini client with required User-Agent
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Helper to safely extract JSON from Gemini text response
function extractJsonFromText(rawText: string): any {
  let cleaned = rawText.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
}

// 1. Analyze Business Website with Gemini Flash + urlContext
app.post('/api/gemini/analyze-business', async (req: Request, res: Response) => {
  try {
    const {
      displayName,
      websiteUrl,
      category,
      formattedAddress,
      phoneNumber,
      pageSpeedSummary,
    } = req.body;

    const systemInstruction = `Eres un auditor comercial senior experto en digitalización de pymes y negocios locales en España.
Tu misión es inspeccionar la presencia web de un negocio local y detectar oportunidades reales para venderles servicios de:
1. Diseño web moderno optimizado para móvil y conversión (si no tienen web, es lenta, anticuada o no inspira confianza).
2. Agente de IA para WhatsApp (atención 24/7, cualificación de leads y resolución de dudas comunes).
3. Sistema automatizado de citas o reservas online (para ahorrar tiempo y evitar llamadas perdidas).

Debes responder SIEMPRE en formato JSON válido estricto, sin explicaciones introductorias ni bloques de texto fuera del JSON. Toda la redacción debe ser en español de España profesional, natural y convincente.`;

    const userPrompt = `Analiza este negocio local y su presencia digital:
Nombre: "${displayName}"
Sector/Categoría: "${category || 'Negocio local'}"
Dirección: "${formattedAddress || 'España'}"
Teléfono: "${phoneNumber || 'No indicado'}"
Sitio Web: ${websiteUrl ? `"${websiteUrl}"` : 'Sin sitio web'}
Datos PageSpeed Mobile: ${pageSpeedSummary ? JSON.stringify(pageSpeedSummary) : 'No disponible'}

Por favor, genera un análisis riguroso con la siguiente estructura JSON exacta:
{
  "activitySummary": "Resumen en exactamente 2 frases claras de a qué se dedica este negocio y qué servicios ofrece.",
  "checklist": {
    "hasHttps": true o false,
    "isMobileResponsive": true o false,
    "hasWhatsAppButton": true o false,
    "hasOnlineBooking": true o false,
    "hasContactForm": true o false,
    "hasOutdatedCopyright": true o false,
    "copyrightYear": "Año detectado o 'No detectado'"
  },
  "contactDetailsFound": {
    "emails": ["lista de emails encontrados en la web o []"],
    "socialLinks": ["enlaces a instagram, facebook, etc. encontrados o []"]
  },
  "detectedIssues": [
    "Problema 1 explicado en lenguaje llano que un dueño de negocio entienda sin tecnicismos",
    "Problema 2...",
    "Problema 3... (entre 3 y 5 problemas en total)"
  ],
  "recommendedService": "web_nueva" | "agente_whatsapp" | "sistema_citas",
  "recommendedServiceReason": "Explicación convincente de por qué este servicio específico es el que mayor retorno inmediato le dará a este negocio particular."
}`;

    let response;
    // Si tiene websiteUrl válida, intentamos primero con la herramienta urlContext
    if (websiteUrl && websiteUrl.startsWith('http')) {
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Por favor examina la web ${websiteUrl} y analiza el negocio:\n\n${userPrompt}`,
          config: {
            systemInstruction,
            tools: [{ urlContext: {} }],
            temperature: 0.2,
          },
        });
      } catch (urlToolErr) {
        console.warn('urlContext call fallback:', urlToolErr);
        // Fallback sin tool en caso de URL inaccesible o bloqueo de dominio
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userPrompt,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });
      }
    } else {
      // Negocio sin web
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });
    }

    const text = response.text || '{}';
    const analysis = extractJsonFromText(text);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error('Error in /api/gemini/analyze-business:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al analizar el negocio con Gemini',
    });
  }
});

// 2. Generate Customized Pitches (Phone, WhatsApp, Email)
app.post('/api/gemini/generate-pitches', async (req: Request, res: Response) => {
  try {
    const {
      businessName,
      category,
      activitySummary,
      detectedIssues,
      recommendedService,
      recommendedServiceReason,
      sellerProfile,
      tone = 'cercano',
    } = req.body;

    const sellerName = sellerProfile?.name || 'David';
    const agencyName = sellerProfile?.agencyName || 'Agencia Digital';
    const valueProp =
      sellerProfile?.valueProposition ||
      'ayudo a negocios locales a conseguir más clientes con webs modernas y automatización';

    const systemInstruction = `Eres un copywriter B2B experto en prospección personal en frío para negocios locales en España.
Redactas mensajes directos, humanos, sin jerga corporativa aburrida, adaptados al canal y al tono solicitado.
NUNCA inventes testimonios falsos ni uses frases cliché como "Espero que este mensaje te encuentre bien".
Los mensajes deben sonar como un profesional de confianza que se ha tomado la molestia de revisar su negocio personalmente.`;

    const userPrompt = `Crea 3 borradores personalizados para contactar a este negocio:
Negocio: "${businessName}" (${category || 'Local'})
A qué se dedica: "${activitySummary}"
Problemas concretos detectados:
${Array.isArray(detectedIssues) ? detectedIssues.map((issue: string, i: number) => `${i + 1}. ${issue}`).join('\n') : '- Falta de digitalización'}
Servicio sugerido: ${recommendedService} (${recommendedServiceReason})

Mi perfil de vendedor:
Nombre: ${sellerName}
Agencia/Proyecto: ${agencyName}
Propuesta de valor: ${valueProp}
Tono deseado: "${tone}" (opciones: cercano, formal, persuasivo, directo)

Devuelve ÚNICAMENTE un JSON con este esquema exacto:
{
  "phoneScript30s": "Guion para llamada de 30 segundos. Incluye gancho inicial que capte su atención rápido, mención al problema clave detectado y una pregunta de cierre para pedir 10 minutos de reunión presencial o por videollamada.",
  "whatsAppMessage": "Mensaje de WhatsApp conciso (1-2 párrafos cortos), conversacional y con emojis profesionales bien seleccionados (máximo 3). Destaca la oportunidad perdida y propone ver una propuesta breve.",
  "emailMessage": "Correo electrónico completo con línea de asunto (Subject) magnética e informal, cuerpo de máximo 150 palabras con el problema detectado, cómo le solucionamos la vida y llamada a la acción sencilla sin compromiso."
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.4,
      },
    });

    const text = response.text || '{}';
    const pitches = extractJsonFromText(text);
    res.json({ success: true, pitches });
  } catch (error: any) {
    console.error('Error in /api/gemini/generate-pitches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al generar los borradores comerciales',
    });
  }
});

// 3. Rank Niches with Strategic Analysis
app.post('/api/gemini/rank-niches', async (req: Request, res: Response) => {
  try {
    const { location, nicheStats } = req.body;

    const systemInstruction = `Eres un estratega comercial y de ventas B2B especializado en venta de desarrollo web, chatbots de WhatsApp y sistemas de reservas para el mercado local español.`;

    const userPrompt = `En la zona "${location}", hemos recopilado las siguientes métricas reales de los negocios locales por nicho:
${JSON.stringify(nicheStats, null, 2)}

Por favor, evalúa qué nichos representan la mayor oportunidad de venta para una agencia de servicios digitales (web, WhatsApp, citas).
Ten en cuenta:
- Más negocios sin web o con webs anticuadas = mayor oportunidad directa de desarrollo web.
- Negocios con muchas reseñas y buena nota = negocios activos con ingresos para pagar servicios.
- Negocios de citas frecuentes (dentistas, peluquerías, fisioterapeutas, talleres, restaurantes) = oportunidad perfecta para agentes de WhatsApp y sistemas de citas.

Devuelve un JSON con este formato exacto:
{
  "topThreeNiches": ["nicho 1", "nicho 2", "nicho 3"],
  "summaryAnalysis": "Breve diagnóstico del mercado local en esta zona en 2 o 3 frases.",
  "rankedNiches": [
    {
      "niche": "Nombre del nicho",
      "opportunityScore": 85, // número de 0 a 100
      "whyReason": "Por qué es o no una buena oportunidad en esta zona",
      "recommendedService": "web_nueva" | "agente_whatsapp" | "sistema_citas",
      "recommendedServiceLabel": "Páginas Web Modernas" | "Agente de IA WhatsApp" | "Sistema de Citas Online",
      "pitchAngle": "Ángulo o gancho comercial clave para entrar a venderles"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const text = response.text || '{}';
    const ranking = extractJsonFromText(text);
    res.json({ success: true, ranking });
  } catch (error: any) {
    console.error('Error in /api/gemini/rank-niches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al clasificar nichos',
    });
  }
});

// Proxy routes for Google Cloud APIs (Places and PageSpeed) to prevent browser CORS
// and keep API communication fast and reliable
app.post('/api/proxy/places-search', async (req: Request, res: Response) => {
  try {
    const apiKey = (req.headers['x-goog-api-key'] as string) || (process.env.GOOGLE_CLOUD_API_KEY as string);
    if (!apiKey) {
      return res.status(400).json({
        error: 'Falta la clave de Google Cloud API. Introdúcela en la pantalla de Ajustes.',
      });
    }

    const fieldMask =
      'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.primaryTypeDisplayName,places.types,places.googleMapsUri,places.businessStatus,nextPageToken';

    const placesRes = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': fieldMask,
        },
        body: JSON.stringify(req.body),
      }
    );

    const data = await placesRes.json();
    if (!placesRes.ok) {
      return res.status(placesRes.status).json(data);
    }
    return res.json(data);
  } catch (error: any) {
    console.error('Error in /api/proxy/places-search:', error);
    return res.status(500).json({ error: error.message || 'Error al consultar Places API' });
  }
});

app.get('/api/proxy/pagespeed', async (req: Request, res: Response) => {
  try {
    const apiKey = (req.headers['x-goog-api-key'] as string) || (req.query.key as string) || (process.env.GOOGLE_CLOUD_API_KEY as string);
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Parámetro url requerido' });
    }

    const categories = ['performance', 'seo', 'accessibility', 'best-practices'];
    const params = new URLSearchParams({
      url: targetUrl,
      strategy: 'mobile',
    });
    categories.forEach((cat) => params.append('category', cat));
    if (apiKey) {
      params.set('key', apiKey);
    }

    const psiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params.toString()}`;
    const psiRes = await fetch(psiUrl);
    const data = await psiRes.json();

    if (!psiRes.ok) {
      return res.status(psiRes.status).json(data);
    }
    return res.json(data);
  } catch (error: any) {
    console.error('Error in /api/proxy/pagespeed:', error);
    return res.status(500).json({ error: error.message || 'Error al consultar PageSpeed API' });
  }
});

// Setup Vite or static serving
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Radar de Clientes server running on http://0.0.0.0:${port}`);
  });
}

startServer();
