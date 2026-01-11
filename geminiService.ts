
import { GoogleGenAI, Type } from "@google/genai";

export const suggestAIConfig = async (
  description: string,
  availableCurrentFields: string[],
  availableExternalFields: string[] 
): Promise<{ prompt: string; inputPaths: string[]; externalAliases: string[]; logicCode: string }> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API 키가 설정되지 않았습니다. 환경 변수를 확인해주세요.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a highly skilled JavaScript developer specialized in data processing.
        Goal: "${description}"
        
        [INPUT SPECIFICATION]
        - 'row' object contains current row data. Keys are exact column names.
        - 'global' object contains helper functions and external data.
        
        [AVAILABLE DATE HELPERS in 'global']
        - global.diffDays(d1, d2): Returns integer difference in days between two dates.
        - global.isToday(d): Returns boolean if date d is today.
        - global.addDays(d, n): Returns 'YYYY-MM-DD' string of date d + n days.
        - global.isPast(d): Returns boolean if date d is before today.
        - global.isFuture(d): Returns boolean if date d is after today.
        - global.formatDate(d): Returns 'YYYY-MM-DD' string.
        - global.오늘날짜: Returns today's date string.
        
        [STRICT LOGIC RULES]
        - Write a JavaScript code that calculates a value and 'return' it.
        - Use row['ColumnName'] to access data.
        - For date logic, ALWAYS use provided global helpers (e.g., global.diffDays(row['Start'], global.오늘날짜)).
        - Current available fields: ${availableCurrentFields.join(', ')}
        - Available external aliases: ${availableExternalFields.join(', ')}
        
        Generate JSON:
        1. "prompt": User's goal description.
        2. "inputPaths": Array of used column names from row object.
        3. "externalAliases": Array of used external aliases from global object.
        4. "logicCode": The JS code snippet (only logic, no function wrapper).
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            inputPaths: { type: Type.ARRAY, items: { type: Type.STRING } },
            externalAliases: { type: Type.ARRAY, items: { type: Type.STRING } },
            logicCode: { type: Type.STRING }
          },
          required: ["prompt", "inputPaths", "externalAliases", "logicCode"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("모델이 빈 응답을 반환했습니다.");
    
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini API Error Detail:", error);
    let msg = error.message || "AI 요청 처리 중 오류가 발생했습니다.";
    if (msg.includes("403")) msg = "API 키가 올바르지 않거나 권한이 없습니다.";
    if (msg.includes("429")) msg = "API 호출 한도를 초과했습니다.";
    throw new Error(msg);
  }
};
