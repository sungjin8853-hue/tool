
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
  // IMPORTANT: inputs now stores Column IDs instead of names to distinguish duplicate names
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
        'timerSec': (v: any) => v?.totalSeconds || 0,
      };
      
      externalFiles.forEach(f => { global[f.alias] = []; });
      externalInputs.forEach(ei => { global[ei.alias] = "0"; });

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

  const toggleInput = (colId: string) => {
    setInputs(prev => prev.includes(colId) ? prev.filter(p => p !== colId) : [...prev, colId]);
  };

  const handleAddExternal = (col: Column) => {
    if (!selectedFile) return;
    const uniqueId = col.id.slice(0, 4);
    const alias = `${selectedFile.name}_${col.name}_${uniqueId}`.replace(/\s+/g, '_');
    
    if (externalInputs.some(ex => ex.columnId === col.id && ex.nodeId === selectedFile.id)) {
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
      const currentFieldInfo = currentColumns.map(c => ({ id: c.id, name: c.name }));
      const externalFieldInfo = externalInputs.map(ex => ({ id: ex.columnId, name: ex.columnName, alias: ex.alias }));
      const externalFileInfo = externalFiles.map(ef => ({ id: ef.nodeId, name: ef.nodeName, alias: ef.alias }));
      
      const result = await suggestAIConfig(desc, currentFieldInfo, externalFieldInfo, externalFileInfo);
      setLogicCode(result.logicCode);
      setInputs(result.inputPaths); // AI will now return IDs
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
            <p className="opacity-80 mt-1 text-sm font-bold tracking-tight">고유 ID 기반으로 필드를 정확히 식별합니다.</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-xl">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto p-10 space-y-10 border-r border-slate-100">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-comment-dots"></i> 1. AI 가이드
              </label>
              <div className="flex gap-4">
                <input 
                  className="flex-1 px-6 py-5 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:ring-4 focus:ring-indigo-500/10 font-bold text-slate-700 transition-all text-lg shadow-inner"
                  placeholder="예: 이름이 같은 열이 있어도 정확하게 계산합니다..."
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
                <span><i className="fa-solid fa-code"></i> 2. JavaScript 로직</span>
                <span className="text-indigo-500 font-black px-2 py-0.5 bg-indigo-50 rounded text-[10px]">ID 식별 지원</span>
              </label>
              <textarea 
                className="w-full p-8 bg-slate-900 text-emerald-400 font-mono text-sm rounded-3xl outline-none min-h-[400px] border border-slate-800 shadow-2xl leading-relaxed focus:ring-2 focus:ring-emerald-500/30"
                value={logicCode}
                onChange={e => setLogicCode(e.target.value)}
                spellCheck={false}
              />
            </div>
          </div>

          <div className="w-[450px] overflow-y-auto p-10 bg-slate-50/50 space-y-8">
            <div className="space-y-4">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-list-check"></i> 현재 행 데이터 (ID 기반 선택)
              </label>
              <div className="grid grid-cols-1 gap-2 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm max-h-[250px] overflow-y-auto scrollbar-hide">
                {currentColumns.map(col => {
                  const isSelected = inputs.includes(col.id);
                  return (
                    <button 
                      key={col.id}
                      onClick={() => toggleInput(col.id)}
                      className={`px-4 py-3 rounded-xl text-[10px] font-black transition-all border text-left flex items-center justify-between gap-2 ${
                        isSelected ? 'bg-indigo-600 text-white border-indigo-500 shadow-md' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <i className={`fa-solid ${isSelected ? 'fa-check-circle' : 'fa-circle-dot opacity-30'}`}></i>
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[8px] opacity-40 font-mono flex-shrink-0">#{col.id.slice(0,4)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-link"></i> 외부 데이터 참조
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
                  <div className="p-5 bg-white rounded-2xl border border-indigo-100 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                      <span className="text-[10px] font-black text-indigo-600 uppercase">항목 선택</span>
                      <button 
                        onClick={handleAddFullFile}
                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${externalFiles.some(ef => ef.nodeId === selectedFile.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                      >
                        배열로 가져오기
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5 max-h-[200px] overflow-y-auto">
                      {selectedFile.columns.map(col => {
                        const isAdded = externalInputs.some(ex => ex.columnId === col.id && ex.nodeId === selectedFile.id);
                        return (
                          <button 
                            key={col.id}
                            onClick={() => handleAddExternal(col)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-[10px] font-bold transition-all ${isAdded ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-transparent text-slate-500 hover:bg-slate-100'}`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <i className={`fa-solid ${isAdded ? 'fa-square-check' : 'fa-square opacity-20'}`}></i>
                              {col.name}
                            </span>
                            <span className="text-[8px] opacity-40 font-mono">#{col.id.slice(0,4)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 bg-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-100 space-y-4">
              <label className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                <i className="fa-solid fa-flask"></i> 계산 미리보기
              </label>
              <div className={`p-6 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all min-h-[100px] ${testResult?.startsWith('Error') ? 'bg-rose-400/20 border-rose-300 text-rose-100' : 'bg-white/10 border-white/20 text-white'}`}>
                  <span className="text-2xl font-black text-center break-all">{testResult || '계산 중...'}</span>
              </div>
              <div className="space-y-1">
                 <label className="text-[9px] font-black text-white/60 uppercase tracking-widest">결과 저장 위치</label>
                 <select 
                    className="w-full p-3 bg-white border-none rounded-xl text-xs font-black text-indigo-700 outline-none"
                    value={outputId}
                    onChange={e => setOutputId(e.target.value)}
                  >
                    {currentColumns.map(c => (
                      <option key={c.id} value={c.id}>{c.name} (#{c.id.slice(0,4)})</option>
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
