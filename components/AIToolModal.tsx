
import React, { useState, useMemo, useEffect } from 'react';
import { Column, ColumnType, AIConfig, Node, ExternalInput, NodeType } from '../types';
import { suggestAIConfig } from '../geminiService';

interface AIToolModalProps {
  root: Node;
  targetColId: string;
  onClose: () => void;
  onSave: (config: AIConfig) => void;
  currentColumns: Column[];
  type: ColumnType;
  sampleRow?: Record<string, any>;
}

const AIToolModal: React.FC<AIToolModalProps> = ({ root, targetColId, onClose, onSave, currentColumns, type, sampleRow }) => {
  const targetCol = useMemo(() => currentColumns.find(c => c.id === targetColId), [currentColumns, targetColId]);
  const existingConfig = targetCol?.aiConfig;

  const [desc, setDesc] = useState(existingConfig?.prompt || '');
  const [logicCode, setLogicCode] = useState(existingConfig?.logicCode || '');
  const [inputs, setInputs] = useState<string[]>(existingConfig?.inputPaths || []);
  const [externalInputs, setExternalInputs] = useState<ExternalInput[]>(existingConfig?.externalInputs || []);
  const [loading, setLoading] = useState(false);
  const [outputId, setOutputId] = useState(existingConfig?.outputColumnId || targetColId);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runTest = () => {
    if (!logicCode) return;
    try {
      const row = sampleRow || {};
      const global = { 
        '오늘 날짜': new Date(), 
        '현재 시간': new Date().toLocaleTimeString(),
        'formatDate': (d: any) => {
          if(!d) return '';
          const date = d instanceof Date ? d : new Date(d);
          return isNaN(date.getTime()) ? String(d) : date.toISOString().split('T')[0];
        }
      };
      currentColumns.forEach(c => { if(!row[c.name]) row[c.name] = (c.type === ColumnType.NUMBER ? 100 : "샘플 데이터"); });
      const execute = new Function('row', 'global', `try { ${logicCode} } catch(e) { return "Error: " + e.message; }`);
      const res = execute(row, global);
      setTestResult(res?.toString() || '값 없음');
    } catch (e: any) {
      setTestResult('문법 오류: ' + e.message);
    }
  };

  useEffect(() => {
    if (logicCode) runTest();
  }, [logicCode]);

  const findFiles = (node: Node, acc: Node[] = []): Node[] => {
    if (node.type === NodeType.FILE) acc.push(node);
    node.children?.forEach(c => findFiles(c, acc));
    return acc;
  };

  const allFiles = useMemo(() => findFiles(root), [root]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const selectedFile = useMemo(() => allFiles.find(f => f.id === activeFileId), [allFiles, activeFileId]);

  const handleAddExternal = (col: Column) => {
    if (!selectedFile) return;
    const alias = `${selectedFile.name}_${col.name}`.replace(/\s+/g, '_');
    if (externalInputs.find(ex => ex.alias === alias)) return;
    setExternalInputs([...externalInputs, { nodeId: selectedFile.id, nodeName: selectedFile.name, columnId: col.id, columnName: col.name, alias }]);
  };

  const handleAutoDesign = async () => {
    if (!desc) return;
    setLoading(true);
    try {
      const currentFieldNames = currentColumns.map(c => c.name);
      const externalAliases = externalInputs.map(ex => ex.alias);
      const result = await suggestAIConfig(desc, currentFieldNames, externalAliases);
      setLogicCode(result.logicCode);
      setInputs(result.inputPaths);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20">
        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
          <div>
            <h3 className="text-3xl font-black flex items-center gap-4">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI 로직 설정 {type === ColumnType.AI_FORMULA ? '(자동 수식)' : '(버튼 실행)'}
            </h3>
            <p className="opacity-80 mt-1 text-sm font-bold tracking-tight">계산 수식과 데이터 흐름을 정의합니다.</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-xl">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 grid grid-cols-12 gap-12">
          <div className="col-span-7 space-y-10">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-comment-dots"></i> 1. AI에게 요청하기 (자연어)
              </label>
              <div className="flex gap-4">
                <input 
                  className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all text-lg shadow-inner"
                  placeholder="예: '점수'가 80점 이상이면 '우수'라고 표시"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                />
                <button onClick={handleAutoDesign} disabled={loading} className="px-10 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg active:scale-95">
                  {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : "생성"}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex justify-between">
                <span><i className="fa-solid fa-code"></i> 2. 생성된 JavaScript 로직</span>
                <span className="text-indigo-500 font-black px-2 py-0.5 bg-indigo-50 rounded text-[10px]">EDITABLE</span>
              </label>
              <textarea 
                className="w-full p-8 bg-slate-900 text-emerald-400 font-mono text-sm rounded-3xl outline-none min-h-[400px] border border-slate-800 shadow-2xl leading-relaxed focus:ring-2 focus:ring-emerald-500/30"
                value={logicCode}
                onChange={e => setLogicCode(e.target.value)}
              />
            </div>
          </div>

          <div className="col-span-5 space-y-10 border-l border-slate-100 pl-12 bg-slate-50/30 rounded-r-3xl">
            <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
               <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                 <i className="fa-solid fa-flask"></i> 실시간 결과 미리보기
               </label>
               <div className={`p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${testResult?.startsWith('Error') ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-indigo-600'}`}>
                  <span className="text-[10px] font-black opacity-40 uppercase mb-3">EXPECTED VALUE</span>
                  <span className="text-3xl font-black text-center break-all">{testResult || '...'}</span>
               </div>
            </div>

            <div className="p-8 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 space-y-6">
              <label className="text-[11px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-file-export"></i> 3. 결과 저장 대상 열 (OUTPUT)
              </label>
              <div className="relative">
                <select 
                  className="w-full p-5 bg-white border-none rounded-2xl text-sm font-black text-indigo-700 outline-none appearance-none cursor-pointer hover:bg-slate-50 transition-colors"
                  value={outputId}
                  onChange={e => setOutputId(e.target.value)}
                >
                  {currentColumns.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">
                  <i className="fa-solid fa-chevron-down"></i>
                </div>
              </div>
              <p className="text-[10px] text-white/70 font-bold leading-relaxed">AI가 계산한 결과값을 저장할 열을 선택하세요.</p>
            </div>

            <div className="space-y-6">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-link"></i> 외부 파일 참조
              </label>
              <select className="w-full p-5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none shadow-sm" onChange={e => setActiveFileId(e.target.value)} value={activeFileId || ''}>
                <option value="">참조할 파일 선택...</option>
                {allFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              {selectedFile && (
                <div className="flex flex-wrap gap-2">
                  {selectedFile.columns.map(c => (
                    <button key={c.id} onClick={() => handleAddExternal(c)} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">
                      + {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-6">
          <button onClick={onClose} className="px-10 py-5 text-sm font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest">취소</button>
          <button 
            disabled={!logicCode}
            onClick={() => onSave({ prompt: desc, inputPaths: inputs, externalInputs, outputColumnId: outputId, logicCode })}
            className="px-20 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all disabled:opacity-40"
          >
            설정 저장 및 적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIToolModal;
