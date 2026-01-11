
import React, { useState, useMemo, useEffect } from 'react';
import { Column, ColumnType, AIConfig, Node, ExternalInput, NodeType, ExternalFileReference } from '../types';
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
  const [externalFiles, setExternalFiles] = useState<ExternalFileReference[]>(existingConfig?.externalFiles || []);
  const [loading, setLoading] = useState(false);
  const [outputId, setOutputId] = useState(existingConfig?.outputColumnId || targetColId);
  const [testResult, setTestResult] = useState<string | null>(null);

  const runTest = () => {
    if (!logicCode) return;
    try {
      const row = sampleRow || {};
      const global: Record<string, any> = { 
        '오늘날짜': new Date().toISOString().split('T')[0],
        'diffDays': (d1: any, d2: any) => {
          if (!d1 || !d2) return 0;
          const date1 = new Date(d1);
          const date2 = new Date(d2);
          const diffTime = date2.getTime() - date1.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },
        'isToday': (d: any) => {
          if (!d) return false;
          return new Date(d).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
        }
      };
      
      // 테스트용 가상 데이터 주입 (Mock Data)
      externalFiles.forEach(f => {
        const mockFile = allFiles.find(af => af.id === f.nodeId);
        if (mockFile) {
          // 실제 파일 데이터가 있으면 사용하고, 없으면 가상 데이터 3개를 생성
          if (mockFile.rows.length > 0) {
            global[f.alias] = mockFile.rows.map(r => {
              const obj: any = {};
              mockFile.columns.forEach(c => { obj[c.name] = r.data[c.id]; obj[c.id] = r.data[c.id]; });
              return obj;
            });
          } else {
            global[f.alias] = [
              { '시간': '2', '공부량': '10', '이름': '더미1' },
              { '시간': '4', '공부량': '20', '이름': '더미2' },
              { '시간': '8', '공부량': '50', '이름': '더미3' }
            ];
          }
        }
      });

      // 현재 행 데이터 보정
      currentColumns.forEach(c => { if(row[c.id] === undefined) row[c.name] = (c.type === ColumnType.NUMBER ? "50" : "데이터"); });
      
      const execute = new Function('row', 'global', `try { ${logicCode} } catch(e) { return "Error: " + e.message; }`);
      const res = execute(row, global);
      setTestResult(res?.toString() || '값 없음');
    } catch (e: any) {
      setTestResult('문법 오류: ' + e.message);
    }
  };

  useEffect(() => {
    if (logicCode) runTest();
  }, [logicCode, inputs, externalFiles]);

  const findFiles = (node: Node, acc: Node[] = []): Node[] => {
    if (node.type === NodeType.FILE) acc.push(node);
    node.children?.forEach(c => findFiles(c, acc));
    return acc;
  };

  const allFiles = useMemo(() => findFiles(root), [root]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const selectedFile = useMemo(() => allFiles.find(f => f.id === activeFileId), [allFiles, activeFileId]);

  const toggleInput = (colName: string) => {
    setInputs(prev => prev.includes(colName) ? prev.filter(p => p !== colName) : [...prev, colName]);
  };

  const handleAddExternal = (col: Column) => {
    if (!selectedFile) return;
    const alias = `${selectedFile.name}_${col.name}`.replace(/\s+/g, '_');
    if (externalInputs.some(ex => ex.alias === alias)) return;
    setExternalInputs([...externalInputs, { nodeId: selectedFile.id, nodeName: selectedFile.name, columnId: col.id, columnName: col.name, alias }]);
  };

  const handleAddFullFile = () => {
    if (!selectedFile) return;
    const alias = selectedFile.name.replace(/\s+/g, '_');
    if (externalFiles.some(ef => ef.nodeId === selectedFile.id)) return;
    setExternalFiles([...externalFiles, { nodeId: selectedFile.id, nodeName: selectedFile.name, alias }]);
  };

  const handleAutoDesign = async () => {
    if (!desc) return;
    setLoading(true);
    try {
      const currentFieldNames = currentColumns.map(c => c.name);
      const externalAliases = externalInputs.map(ex => ex.alias);
      const externalFileAliases = externalFiles.map(ef => ef.alias);
      
      const result = await suggestAIConfig(desc, currentFieldNames, externalAliases, externalFileAliases);
      setLogicCode(result.logicCode);
      setInputs(result.inputPaths);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-6xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20">
        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shadow-lg">
          <div>
            <h3 className="text-3xl font-black flex items-center gap-4">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI 로직 설정 {type === ColumnType.AI_FORMULA ? '(자동 수식)' : '(버튼 실행)'}
            </h3>
            <p className="opacity-80 mt-1 text-sm font-bold tracking-tight">수식과 외부 데이터 집계 로직을 정의합니다.</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-xl">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-12 grid grid-cols-12 gap-12">
          <div className="col-span-7 space-y-10">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-comment-dots"></i> 1. AI에게 요청하기 (예시처럼 상세히 적어주세요)
              </label>
              <div className="flex gap-4">
                <input 
                  className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all text-lg shadow-inner"
                  placeholder="'공부기록' 파일에서 '시간'이 5 이하인 데이터의 '공부량' 평균 계산"
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
                <span><i className="fa-solid fa-code"></i> 2. JavaScript 로직 (직접 수정 가능)</span>
                <span className="text-indigo-500 font-black px-2 py-0.5 bg-indigo-50 rounded text-[10px]">EDITABLE</span>
              </label>
              <textarea 
                className="w-full p-8 bg-slate-900 text-emerald-400 font-mono text-sm rounded-3xl outline-none min-h-[350px] border border-slate-800 shadow-2xl leading-relaxed focus:ring-2 focus:ring-emerald-500/30"
                value={logicCode}
                onChange={e => setLogicCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>

          <div className="col-span-5 space-y-8 border-l border-slate-100 pl-12 bg-slate-50/30 rounded-r-3xl">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-list-check"></i> 현재 행 데이터 선택
              </label>
              <div className="flex flex-wrap gap-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm max-h-[120px] overflow-y-auto">
                {currentColumns.map(col => {
                  const isSelected = inputs.includes(col.name);
                  return (
                    <button 
                      key={col.id}
                      onClick={() => toggleInput(col.name)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border ${
                        isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      {isSelected && '✓ '} {col.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4">
               <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                 <i className="fa-solid fa-flask"></i> 실시간 결과 미리보기
               </label>
               <div className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${testResult?.startsWith('Error') ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-slate-50 border-slate-200 text-indigo-600'}`}>
                  <span className="text-[9px] font-black opacity-40 uppercase mb-1">PREVIEW RESULT</span>
                  <span className="text-2xl font-black text-center break-all">{testResult || '...'}</span>
               </div>
               <p className="text-[9px] text-slate-400 font-bold text-center">※ 외부 파일에 데이터가 없을 경우 가상 데이터로 테스트합니다.</p>
            </div>

            <div className="space-y-6">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-link"></i> 참조 설정 (외부 파일 데이터)
              </label>
              <div className="space-y-3">
                <select className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none shadow-sm" onChange={e => setActiveFileId(e.target.value)} value={activeFileId || ''}>
                  <option value="">참조할 파일 선택...</option>
                  {allFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                
                {selectedFile && (
                  <div className="flex flex-col gap-3 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <button 
                      onClick={handleAddFullFile}
                      className="w-full py-2 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-table"></i> 파일 전체(배열) 참조 추가
                    </button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                {externalFiles.map(ef => (
                  <div key={ef.nodeId} className="flex items-center justify-between p-3 bg-white border border-indigo-100 rounded-xl shadow-sm">
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-table text-indigo-400 text-xs"></i>
                      <span className="text-[10px] font-black text-slate-600">{ef.nodeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">global.{ef.alias}</code>
                      <button onClick={() => setExternalFiles(externalFiles.filter(x => x.nodeId !== ef.nodeId))} className="text-slate-300 hover:text-rose-500"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-indigo-600 rounded-3xl shadow-xl shadow-indigo-200 space-y-4">
              <label className="text-[10px] font-black text-white uppercase tracking-widest">결과 저장 열</label>
              <select 
                className="w-full p-4 bg-white border-none rounded-2xl text-xs font-black text-indigo-700 outline-none"
                value={outputId}
                onChange={e => setOutputId(e.target.value)}
              >
                {currentColumns.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-6">
          <button onClick={onClose} className="px-10 py-5 text-sm font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest">취소</button>
          <button 
            disabled={!logicCode}
            onClick={() => onSave({ prompt: desc, inputPaths: inputs, externalInputs, externalFiles, outputColumnId: outputId, logicCode })}
            className="px-20 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 transition-all"
          >
            설정 저장 및 적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIToolModal;
