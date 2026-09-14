import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

app.get("/", (req, res) => {
  res.send("WhatsApp Estudio Holgado webhook activo");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const change = req.body?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];

    if (!message) return;

    if (message.type !== "text") {
      console.log("Mensaje no textual recibido:", message.type);
      return;
    }

    const from = message.from;
    const text = message.text?.body?.trim();

    if (!from || !text) return;

    console.log("Mensaje recibido de", from, ":", text);

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      instructions:
        "Sos el asistente de WhatsApp de Estudio Holgado Despachantes. Respondé en español, de forma clara, profesional y breve. Si no tenés información suficiente, pedí el dato faltante y no inventes información.",
      input: text,
    });

    const answer =
      response.output_text?.trim() ||
      "No pude generar una respuesta en este momento.";

    const whatsappResponse = await fetch(
      `https://graph.facebook.com/v26.0/${PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: answer,
          },
        }),
      }
    );

    if (!whatsappResponse.ok) {
      const errorText = await whatsappResponse.text();
      console.error("Error enviando WhatsApp:", errorText);
      return;
    }

    console.log("Respuesta enviada correctamente a", from);
  } catch (error) {
    console.error("Error procesando webhook:", error);
  }
});

const port = process.env.PORT || 10000;

app.listen(port, () => {
  console.log(`Servidor activo en puerto ${port}`);
});
