
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
        },
        'num': (v: any) => parseFloat(v || 0),
        'timerSec': (v: any) => {
          if (!v || typeof v.totalSeconds !== 'number') return 0;
          return v.totalSeconds;
        },
        'timerMin': (v: any) => {
          if (!v || typeof v.totalSeconds !== 'number') return 0;
          return v.totalSeconds / 60;
        },
        'timerHr': (v: any) => {
          if (!v || typeof v.totalSeconds !== 'number') return 0;
          return v.totalSeconds / 3600;
        }
      };
      
      // 외부 파일 데이터 모킹
      externalFiles.forEach(f => {
        global[f.alias] = [{ dummy: 'data' }];
      });
      externalInputs.forEach(ei => {
        global[ei.alias] = "100"; // 테스트용 더미 값
      });

      const execute = new Function('row', 'global', `try { ${logicCode} } catch(e) { return "Error: " + e.message; }`);
      const res = execute(row, global);
      setTestResult(res?.toString() || '값 없음');
    } catch (e: any) {
      setTestResult('문법 오류: ' + e.message);
    }
  };

  useEffect(() => {
    if (logicCode) runTest();
  }, [logicCode, inputs, externalFiles, externalInputs]);

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
    // 같은 이름이라도 고유 ID를 붙여서 다른 데이터처럼 취급할 수 있게 함
    const uniqueId = col.id.slice(0, 4);
    const alias = `${selectedFile.name}_${col.name}_${uniqueId}`.replace(/\s+/g, '_');
    
    if (externalInputs.some(ex => ex.columnId === col.id && ex.nodeId === selectedFile.id)) {
      // 이미 추가된 경우 제거 (토글 방식)
      setExternalInputs(externalInputs.filter(ex => !(ex.columnId === col.id && ex.nodeId === selectedFile.id)));
      return;
    }
    
    setExternalInputs([...externalInputs, { 
      nodeId: selectedFile.id, 
      nodeName: selectedFile.name, 
      columnId: col.id, 
      columnName: col.name, 
      alias 
    }]);
  };

  const handleAddFullFile = () => {
    if (!selectedFile) return;
    const alias = selectedFile.name.replace(/\s+/g, '_');
    if (externalFiles.some(ef => ef.nodeId === selectedFile.id)) {
      setExternalFiles(externalFiles.filter(ef => ef.nodeId !== selectedFile.id));
      return;
    }
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
      <div className="bg-white w-full max-w-7xl rounded-[3rem] shadow-2xl flex flex-col overflow-hidden max-h-[95vh] border border-white/20">
        <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shadow-lg shrink-0">
          <div>
            <h3 className="text-3xl font-black flex items-center gap-4">
              <i className="fa-solid fa-wand-magic-sparkles"></i> AI 로직 설정
            </h3>
            <p className="opacity-80 mt-1 text-sm font-bold tracking-tight">수식과 외부 파일 참조를 설정하여 데이터를 자동화합니다.</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-xl">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          {/* Left Column: Editor */}
          <div className="flex-1 overflow-y-auto p-10 space-y-10 border-r border-slate-100">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-comment-dots"></i> 1. AI 가이드 (자연어로 요청)
              </label>
              <div className="flex gap-4">
                <input 
                  className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all text-lg shadow-inner"
                  placeholder="예: '외부기록'의 '점수'가 '현재파일'의 '목표'보다 높으면 '통과'라고 표시"
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
                spellCheck={false}
              />
            </div>
          </div>

          {/* Right Column: Field Selector */}
          <div className="w-[450px] overflow-y-auto p-10 bg-slate-50/50 space-y-8">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-list-check"></i> 현재 행 데이터 (입력값)
              </label>
              <div className="grid grid-cols-2 gap-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                {currentColumns.map(col => {
                  const isSelected = inputs.includes(col.name);
                  return (
                    <button 
                      key={col.id}
                      onClick={() => toggleInput(col.name)}
                      className={`px-3 py-2 rounded-xl text-[10px] font-black transition-all border text-left flex items-center gap-2 ${
                        isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <i className={`fa-solid ${isSelected ? 'fa-check-circle' : 'fa-circle-dot opacity-30'}`}></i>
                      {col.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-link"></i> 외부 데이터 연결 (참조)
              </label>
              <div className="space-y-4">
                <select 
                  className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 outline-none shadow-sm focus:ring-2 focus:ring-indigo-100" 
                  onChange={e => setActiveFileId(e.target.value)} 
                  value={activeFileId || ''}
                >
                  <option value="">불러올 파일 선택...</option>
                  {allFiles.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
                
                {selectedFile && (
                  <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">파일 내 데이터 항목</span>
                      <button 
                        onClick={handleAddFullFile}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${externalFiles.some(ef => ef.nodeId === selectedFile.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        파일 전체(배열)로 가져오기
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {selectedFile.columns.map(col => {
                        const isAdded = externalInputs.some(ex => ex.columnId === col.id && ex.nodeId === selectedFile.id);
                        return (
                          <button 
                            key={col.id}
                            onClick={() => handleAddExternal(col)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-[10px] font-bold transition-all ${isAdded ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                          >
                            <span className="flex items-center gap-2">
                              <i className={`fa-solid ${isAdded ? 'fa-square-check' : 'fa-square opacity-20'}`}></i>
                              {col.name}
                            </span>
                            <span className="text-[9px] opacity-40 uppercase font-black">{col.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest block px-1">현재 활성화된 외부 참조 리스트</label>
                {externalInputs.length === 0 && externalFiles.length === 0 && (
                  <div className="py-8 text-center bg-slate-100/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold">선택된 참조 데이터가 없습니다.</p>
                  </div>
                )}
                {externalFiles.map(ef => (
                  <div key={ef.nodeId} className="flex items-center justify-between p-3 bg-indigo-600 text-white rounded-xl shadow-md animate-in zoom-in-95">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <i className="fa-solid fa-table text-xs"></i>
                      <span className="text-[10px] font-black truncate">{ef.nodeName} (전체)</span>
                    </div>
                    <code className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-bold">global.{ef.alias}</code>
                  </div>
                ))}
                {externalInputs.map(ex => (
                  <div key={`${ex.nodeId}_${ex.columnId}`} className="flex items-center justify-between p-3 bg-white border border-indigo-100 rounded-xl shadow-sm animate-in zoom-in-95">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <i className="fa-solid fa-link text-indigo-400 text-[10px]"></i>
                      <span className="text-[10px] font-black text-slate-600 truncate">{ex.columnName} <span className="text-[8px] opacity-40 ml-1">from {ex.nodeName}</span></span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <code className="text-[9px] bg-indigo-50 px-1.5 py-0.5 rounded text-indigo-600 font-bold">global.{ex.alias}</code>
                      <button onClick={() => setExternalInputs(externalInputs.filter(x => x.alias !== ex.alias))} className="text-slate-300 hover:text-rose-500 transition-colors"><i className="fa-solid fa-xmark"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-100 space-y-4">
              <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-flask"></i> 실시간 미리보기 결과
              </label>
              <div className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all min-h-[100px] ${testResult?.startsWith('Error') ? 'bg-rose-400/20 border-rose-300 text-rose-100' : 'bg-white/10 border-white/20 text-white'}`}>
                  <span className="text-2xl font-black text-center break-all">{testResult || '계산 대기 중...'}</span>
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">결과값 저장 위치</label>
                 <select 
                    className="w-full p-3 bg-white border-none rounded-xl text-xs font-black text-indigo-700 outline-none"
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
        </div>

        <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-6 shrink-0">
          <button onClick={onClose} className="px-10 py-5 text-sm font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest">취소</button>
          <button 
            disabled={!logicCode}
            onClick={() => onSave({ prompt: desc, inputPaths: inputs, externalInputs, externalFiles, outputColumnId: outputId, logicCode })}
            className="px-24 py-5 bg-indigo-600 text-white rounded-3xl font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0 transition-all disabled:opacity-30"
          >
            설정 저장 및 적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIToolModal;
