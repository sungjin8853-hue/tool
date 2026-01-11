
import { GoogleGenAI, Type } from "@google/genai";

export const suggestAIConfig = async (
  description: string,
  availableCurrentFields: string[],
  availableExternalFields: string[],
  availableExternalFiles: string[] 
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
        - 'row' object: Current row data. row['ColumnName']
        - 'global' object: Helper functions and external data.
        
        [STRICT DATA RULES]
        1. Numerical strings: Use parseFloat(val || 0) or global.num(val) before math.
        2. Timer values (ColumnType.TIMER): Use these helpers exclusively for calculation:
           - global.timerSec(row['TimerCol']): Returns total seconds as Number.
           - global.timerMin(row['TimerCol']): Returns total minutes as Number.
           - global.timerHr(row['TimerCol']): Returns total hours as Number.
           - Use them to divide or multiply: e.g., global.timerHr(row['Time']) * global.num(row['Rate'])
        
        [CONTEXT]
        - Current fields: ${availableCurrentFields.join(', ')}
        - External aliases (Arrays/Values): ${availableExternalFields.join(', ')}, ${availableExternalFiles.join(', ')}
        
        Generate JSON:
        1. "prompt": User goal.
        2. "inputPaths": Used column names from 'row'.
        3. "externalAliases": Used aliases from 'global'.
        4. "logicCode": The JS code snippet. Must 'return' a result.
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
    throw new Error(msg);
  }
};
