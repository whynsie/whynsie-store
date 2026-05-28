import { GoogleGenerativeAI } from '@google/generative-ai';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Только POST запросы' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("СЕРВЕР НЕ ВИДИТ API КЛЮЧ! Проверь файл .env.local");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 🔥 ВОТ ОНА — ТВОЯ РАБОЧАЯ СОВРЕМЕННАЯ МОДЕЛЬ:
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

    const userMessage = req.body.message;
    
    const systemInstruction = `
      Ты — крутой виртуальный менеджер битмейкера по имени whynsie. 
      Whynsie пишет биты в жанрах: 90s soul, R&B, trap, phonk и drill.
      Твоя задача — коротко, стильно и вежливо отвечать клиентам, помогать им с выбором настроения или жанра.
      Если клиент хочет купить бит, всегда отправляй его писать напрямую в Telegram: t.me/whynsie.
      Отвечай кратко, не пиши огромные тексты. Используй музыкальный сленг в меру.
      
      Сообщение от клиента: "${userMessage}"
    `;

    const result = await model.generateContent(systemInstruction);
    const response = await result.response;
    const text = response.text();

    res.status(200).json({ reply: text });
    
  } catch (error: any) {
    console.error('==== ОШИБКА ИИ ====', error.message || error);
    res.status(500).json({ reply: 'Бро, сейчас сервер немного перегружен. Напиши мне лучше напрямую в ТГ!' });
  }
}