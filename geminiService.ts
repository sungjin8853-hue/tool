
import { GoogleGenAI, Type } from "@google/genai";

export const suggestAIConfig = async (
  description: string,
  availableCurrentFields: { id: string, name: string }[],
  availableExternalFields: { id: string, name: string, alias: string }[],
  availableExternalFiles: { id: string, name: string, alias: string }[] 
): Promise<{ prompt: string; inputPaths: string[]; externalAliases: string[]; logicCode: string }> => {
  const apiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey === "") {
    throw new Error("API_KEY가 설정되지 않았습니다. GitHub Secrets 또는 환경 변수를 확인해주세요.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const fieldListStr = availableCurrentFields.map(f => `[ID: ${f.id}, Name: ${f.name}]`).join(', ');
    const extFieldListStr = availableExternalFields.map(f => `[Alias: ${f.alias}, Name: ${f.name}]`).join(', ');
    const extFileListStr = availableExternalFiles.map(f => `[Alias: ${f.alias}, Name: ${f.name}]`).join(', ');

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        You are a JavaScript data processing expert. Generate a logic snippet.
        
        [USER GOAL]
        "${description}"
        
        [CONTEXT - CURRENT ROW FIELDS]
        ${fieldListStr}
        (Note: Multiple columns may have the same name. Use row['ID'] for absolute uniqueness or row['Name'] for readability if unique.)
        
        [CONTEXT - EXTERNAL DATA]
        - External Fields (Single values): ${extFieldListStr}
        - External Files (Arrays of objects): ${extFileListStr}
        
        [AVAILABLE OBJECTS]
        1. 'row': Current row data. Access by ID (recommended for uniqueness) or Name.
        2. 'global': 
           - global.num(val): Safe parseFloat
           - global.isToday(date): Boolean
           - global.diffDays(d1, d2): Difference in days
           - global.timerSec(timerCell): Current timer value
           - External aliases are properties of 'global'
        
        [OUTPUT RULES]
        - Return a JSON object.
        - 'inputPaths' MUST be an array of column IDs (not names) used from 'row'.
        - 'logicCode' MUST be the JS code string. Use 'return' for the final value.
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING },
            inputPaths: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of Column IDs used" },
            externalAliases: { type: Type.ARRAY, items: { type: Type.STRING } },
            logicCode: { type: Type.STRING }
          },
          required: ["prompt", "inputPaths", "externalAliases", "logicCode"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("AI 응답 생성 실패");
    
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error(error.message || "AI 처리 중 오류 발생");
  }
};
