
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Node, ColumnType, Column, Row, ViewFilter, FilterCondition, FilterOperator, NodeType, AIConfig } from '../types';

const formatTime = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

const formatDateForInput = (val: any) => {
  if (!val) return '';
  try {
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const SmartBadge = ({ value, type }: { value: any; type?: ColumnType }) => {
  if (value === undefined || value === null || value === '') {
    return <span className="text-slate-300 font-medium opacity-50">-</span>;
  }
  
  const strValue = String(value);
  const isError = strValue.startsWith('Error:');
  const isWarning = strValue.includes('긴급') || strValue.includes('지연') || strValue.includes('위험');
  const isSuccess = strValue.includes('완료') || strValue.includes('정상') || strValue.includes('성공');
  
  let colorClass = "bg-slate-50 text-slate-700 border-slate-200";
  if (isError) colorClass = "bg-rose-50 text-rose-600 border-rose-200 font-bold";
  else if (isWarning) colorClass = "bg-amber-50 text-amber-600 border-amber-200";
  else if (isSuccess) colorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
  
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border uppercase tracking-tight transition-all inline-block max-w-full truncate shadow-sm ${colorClass}`}>
      {strValue}
    </span>
  );
};

const TimerCell = ({ value, onChange }: { value: any; onChange: (v: any) => void }) => {
  const data = value || { totalSeconds: 0, startTime: null };
  const [displaySeconds, setDisplaySeconds] = useState(data.totalSeconds);
  const isRunning = data.startTime !== null;
  
  useEffect(() => {
    let interval: number;
    if (isRunning) {
      interval = window.setInterval(() => {
        const elapsedSinceStart = Math.floor((Date.now() - data.startTime!) / 1000);
        setDisplaySeconds(data.totalSeconds + elapsedSinceStart);
      }, 1000);
    } else { 
      setDisplaySeconds(data.totalSeconds); 
    }
    return () => clearInterval(interval);
  }, [isRunning, data]);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) {
      const elapsedSinceStart = Math.floor((Date.now() - data.startTime!) / 1000);
      onChange({ totalSeconds: data.totalSeconds + elapsedSinceStart, startTime: null });
    } else { 
      onChange({ ...data, startTime: Date.now() }); 
    }
  };

  return (
    <div className="flex items-center gap-2 group/timer">
      <div className={`font-mono text-[11px] font-black px-2 py-1 rounded border shadow-sm ${isRunning ? 'bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-500/20' : 'bg-slate-50 text-slate-500'}`}>
        {formatTime(displaySeconds)}
      </div>
      <button onClick={toggle} className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isRunning ? 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'}`}>
        <i className={`fa-solid ${isRunning ? 'fa-pause text-[8px]' : 'fa-play text-[8px]'}`}></i>
      </button>
    </div>
  );
};

interface FileViewProps {
  file: Node;
  path: Node[];
  activeViewId: string | null;
  onSelectView: (id: string | null) => void;
  onUpdateViews: (views: ViewFilter[]) => void;
  onAddColumn: (type: ColumnType) => void;
  onAddRow: () => void;
  onUpdateCell: (rid: string, cid: string, val: any) => void;
  onOpenToolCreator: (cid: string, type: ColumnType) => void;
  onRunTool: (rid: string, cid: string, config: AIConfig) => void;
  onAddChildFile: () => void;
  onRenameColumn: (cid: string, name: string) => void;
  onDeleteColumn: (cid: string) => void;
  onMoveColumn: (cid: string, dir: 'left' | 'right') => void;
}

const FileView: React.FC<FileViewProps> = (props) => {
  const { file, path, activeViewId, onSelectView, onUpdateViews, onAddColumn, onAddRow, onUpdateCell, onOpenToolCreator, onRunTool, onAddChildFile, onDeleteColumn, onRenameColumn, onMoveColumn } = props;
  const [isColMenuOpen, setIsColMenuOpen] = useState(false);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const activeView = useMemo(() => file.views?.find(v => v.id === activeViewId), [file.views, activeViewId]);

  const filteredRows = useMemo(() => {
    if (!activeView || !activeView.conditions || activeView.conditions.length === 0) return file.rows;
    return file.rows.filter(row => {
      return activeView.conditions.every(cond => {
        const rawValue = row.data[cond.columnId];
        if (rawValue === undefined || rawValue === null) return false;
        
        const cellValueStr = String(rawValue).toLowerCase();
        const condValueStr = String(cond.value || '').toLowerCase();
        const cellNum = parseFloat(rawValue);
        const condNum = parseFloat(cond.value);

        switch (cond.operator) {
          case 'equals': return cellValueStr === condValueStr;
          case 'contains': return cellValueStr.includes(condValueStr);
          case 'gt': return !isNaN(cellNum) && cellNum > condNum;
          case 'lt': return !isNaN(cellNum) && cellNum < condNum;
          case 'date_is': {
            const targetDate = cond.value === 'TODAY' ? new Date().toISOString().split('T')[0] : cond.value;
            const cellDate = formatDateForInput(rawValue);
            return cellDate !== '' && cellDate === targetDate;
          }
          case 'date_within': {
            const days = parseInt(cond.value);
            if (isNaN(days)) return true;
            const cellDate = new Date(rawValue);
            if (isNaN(cellDate.getTime())) return false;
            const today = new Date();
            today.setHours(0,0,0,0);
            const diffTime = Math.abs(today.getTime() - cellDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= days;
          }
          default: return true;
        }
      });
    });
  }, [file.rows, activeView]);

  const updateViewSettings = (updatedView: ViewFilter) => {
    const newViews = file.views?.map(v => v.id === updatedView.id ? updatedView : v) || [];
    onUpdateViews(newViews);
  };

  const addFilterCondition = () => {
    if (!activeView) return;
    const firstCol = file.columns[0];
    const newCond: FilterCondition = {
      id: Math.random().toString(36).substr(2, 9),
      columnId: firstCol?.id || '',
      operator: firstCol?.type === ColumnType.DATE ? 'date_is' : 'contains',
      value: ''
    };
    updateViewSettings({ ...activeView, conditions: [...activeView.conditions, newCond] });
  };

  const removeFilterCondition = (condId: string) => {
    if (!activeView) return;
    updateViewSettings({ ...activeView, conditions: activeView.conditions.filter(c => c.id !== condId) });
  };

  const updateCondition = (condId: string, updates: Partial<FilterCondition>) => {
    if (!activeView) return;
    updateViewSettings({
      ...activeView,
      conditions: activeView.conditions.map(c => c.id === condId ? { ...c, ...updates } : c)
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
      <div className="p-6 md:p-8 border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide text-[10px] font-black uppercase tracking-widest text-slate-300">
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <i className="fa-solid fa-chevron-right scale-75 opacity-30"></i>}
              <div className={i === path.length - 1 ? 'text-indigo-600' : ''}>{p.name}</div>
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tighter flex items-center">
            <i className="fa-solid fa-table-list text-indigo-500 mr-4"></i>
            {file.name}
          </h2>
          <div className="flex gap-2">
            <button onClick={onAddChildFile} className="px-5 py-2.5 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all uppercase tracking-widest">파일 복제</button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => { onSelectView(null); setShowFilterSettings(false); }} 
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-black transition-all ${!activeViewId ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            전체 데이터
          </button>
          
          {file.views?.map(v => (
            <div key={v.id} className="flex items-center gap-1 group/tab">
              <button 
                onClick={() => onSelectView(v.id)} 
                className={`whitespace-nowrap px-4 py-2 rounded-lg text-[10px] font-black transition-all ${activeViewId === v.id ? 'bg-indigo-50 text-indigo-600 border border-indigo-200 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                {v.name}
              </button>
              
              {activeViewId === v.id && (
                <button 
                  onClick={() => setShowFilterSettings(!showFilterSettings)} 
                  className={`p-1.5 rounded-md transition-all ${showFilterSettings ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:text-indigo-500 hover:bg-indigo-50'}`}
                  title="필터 설정 토글"
                >
                  <i className="fa-solid fa-filter-circle-dollar text-[10px]"></i>
                </button>
              )}
              
              <button 
                onClick={() => onUpdateViews(file.views?.filter(x => x.id !== v.id) || [])} 
                className="opacity-0 group-hover/tab:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
              >
                <i className="fa-solid fa-xmark text-[10px]"></i>
              </button>
            </div>
          ))}
          
          <button onClick={() => {
            const id = Math.random().toString(36).substr(2, 9);
            onUpdateViews([...(file.views || []), { id, name: '새 보기', conditions: [] }]);
            onSelectView(id);
            setShowFilterSettings(true);
          }} className="text-slate-300 hover:text-indigo-500 transition-all ml-2"><i className="fa-solid fa-plus-circle text-sm"></i></button>
        </div>

        {activeView && showFilterSettings && (
          <div className="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-200 animate-in fade-in slide-in-from-top-2 overflow-hidden max-h-[500px] transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <i className="fa-solid fa-filter text-indigo-500"></i>
                <input 
                  className="bg-transparent border-none outline-none font-black text-slate-700 text-sm focus:ring-2 focus:ring-indigo-100 rounded px-1"
                  value={activeView.name}
                  onChange={(e) => updateViewSettings({ ...activeView, name: e.target.value })}
                  placeholder="보기 이름 수정..."
                />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addFilterCondition} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm">
                  <i className="fa-solid fa-plus mr-1"></i> 조건 추가
                </button>
                <button onClick={() => setShowFilterSettings(false)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-300 transition-all shadow-sm">
                  <i className="fa-solid fa-eye-slash mr-1"></i> 숨기기
                </button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 scrollbar-hide">
              {activeView.conditions.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-bold italic py-4 text-center bg-white/50 rounded-xl border border-dashed border-slate-200">설정된 필터 조건이 없습니다. 전체 데이터가 표시됩니다.</p>
              ) : (
                activeView.conditions.map(cond => {
                  const targetColumn = file.columns.find(c => c.id === cond.columnId);
                  const supportsDateFilter = targetColumn && [ColumnType.DATE, ColumnType.AI_FORMULA, ColumnType.AI_BUTTON].includes(targetColumn.type);
                  
                  return (
                    <div key={cond.id} className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-left-2">
                      <select 
                        className="text-[10px] font-black p-1.5 bg-slate-50 border border-slate-100 rounded-lg outline-none text-slate-600"
                        value={cond.columnId}
                        onChange={(e) => {
                          const newColId = e.target.value;
                          const newCol = file.columns.find(c => c.id === newColId);
                          const isNewColDateCapable = newCol && [ColumnType.DATE, ColumnType.AI_FORMULA, ColumnType.AI_BUTTON].includes(newCol.type);
                          updateCondition(cond.id, { 
                            columnId: newColId, 
                            operator: isNewColDateCapable ? 'date_is' : 'contains',
                            value: '' 
                          });
                        }}
                      >
                        {file.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      
                      <select 
                        className="text-[10px] font-black p-1.5 bg-slate-50 border border-slate-100 rounded-lg outline-none text-indigo-600"
                        value={cond.operator}
                        onChange={(e) => updateCondition(cond.id, { operator: e.target.value as FilterOperator })}
                      >
                        {supportsDateFilter ? (
                          <>
                            <option value="date_is">날짜 일치</option>
                            <option value="date_within">최근 N일 이내</option>
                            <option value="contains">텍스트 포함</option>
                            <option value="equals">정확히 일치</option>
                            <option value="gt">큼 (&gt;)</option>
                            <option value="lt">작음 (&lt;)</option>
                          </>
                        ) : (
                          <>
                            <option value="contains">포함</option>
                            <option value="equals">일치</option>
                            <option value="gt">큼 (&gt;)</option>
                            <option value="lt">작음 (&lt;)</option>
                          </>
                        )}
                      </select>

                      {cond.operator === 'date_within' ? (
                        <div className="flex items-center gap-2">
                          <input 
                            type="number"
                            className="w-16 text-[10px] font-bold p-1.5 bg-slate-50 border border-slate-100 rounded-lg outline-none text-indigo-600"
                            placeholder="일 수"
                            value={cond.value}
                            onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                          />
                          <span className="text-[9px] font-black text-slate-400">일 이내</span>
                        </div>
                      ) : (
                        <input 
                          type={cond.operator === 'date_is' ? 'date' : 'text'}
                          className="flex-1 min-w-[100px] text-[10px] font-bold p-1.5 bg-slate-50 border border-slate-100 rounded-lg outline-none"
                          placeholder={cond.operator === 'date_is' ? '' : "검색 값..."}
                          value={cond.value}
                          onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                        />
                      )}
                      
                      <button onClick={() => removeFilterCondition(cond.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><i className="fa-solid fa-trash-can text-[10px]"></i></button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-white border-b border-slate-100">
              <th className="w-12 p-4 text-[10px] text-slate-300 font-black italic">#</th>
              {file.columns.map((col, cidx) => (
                <th key={col.id} className="p-4 text-left font-black text-slate-500 min-w-[220px] group border-r border-slate-50 last:border-r-0 relative">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className={`w-6 h-6 flex-shrink-0 rounded-lg text-[10px] flex items-center justify-center shadow-sm ${col.type.startsWith('AI') ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                         {col.type === ColumnType.AI_FORMULA ? <i className="fa-solid fa-wand-sparkles"></i> : col.type === ColumnType.AI_BUTTON ? <i className="fa-solid fa-bolt"></i> : <i className="fa-solid fa-font"></i>}
                      </span>
                      <input 
                        className="bg-transparent border-none outline-none font-black text-slate-700 w-full truncate focus:ring-2 focus:ring-indigo-100 rounded px-1 -ml-1 transition-all"
                        value={col.name}
                        onChange={(e) => onRenameColumn(col.id, e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {cidx > 0 && (
                        <button onClick={() => onMoveColumn(col.id, 'left')} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="왼쪽으로 이동"><i className="fa-solid fa-arrow-left text-[10px]"></i></button>
                      )}
                      {cidx < file.columns.length - 1 && (
                        <button onClick={() => onMoveColumn(col.id, 'right')} className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors" title="오른쪽으로 이동"><i className="fa-solid fa-arrow-right text-[10px]"></i></button>
                      )}
                      {col.type.startsWith('AI') && (
                        <button onClick={() => onOpenToolCreator(col.id, col.type)} className="p-1.5 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><i className="fa-solid fa-gear text-[11px]"></i></button>
                      )}
                      <button onClick={() => onDeleteColumn(col.id)} className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"><i className="fa-solid fa-trash-can text-[11px]"></i></button>
                    </div>
                  </div>
                </th>
              ))}
              <th className="p-4 w-16 sticky right-0 bg-white z-10 shadow-[-10px_0_15px_-10px_rgba(0,0,0,0.05)] text-center">
                 <div className="relative" ref={colMenuRef}>
                    <button onClick={() => setIsColMenuOpen(!isColMenuOpen)} className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:shadow-lg transition-all"><i className="fa-solid fa-plus text-sm"></i></button>
                    {isColMenuOpen && (
                      <div className="absolute top-11 right-0 w-44 bg-white border border-slate-200 rounded-2xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2">
                        {['TEXT', 'NUMBER', 'DATE', 'AI_BUTTON', 'AI_FORMULA', 'TIMER'].map(t => (
                          <button key={t} onClick={() => { onAddColumn(ColumnType[t as keyof typeof ColumnType]); setIsColMenuOpen(false); }} className="w-full px-4 py-2.5 text-left text-[11px] font-black text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3">{t}</button>
                        ))}
                      </div>
                    )}
                 </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-slate-50/80 border-b border-slate-50 transition-colors">
                <td className="p-3 text-center text-[10px] text-slate-300 font-black italic">{idx + 1}</td>
                {file.columns.map(col => {
                  const cellValue = row.data[col.id];
                  return (
                    <td key={col.id} className="p-2 border-r border-slate-50 last:border-r-0">
                      <div className="flex items-center gap-2 group/cell">
                        {col.type === ColumnType.DATE ? (
                          <input 
                            className="w-full px-3 py-2 bg-transparent focus:bg-white rounded-xl outline-none border border-transparent focus:border-indigo-100 transition-all font-bold text-slate-700 text-xs" 
                            type="date" 
                            value={formatDateForInput(cellValue)} 
                            onChange={(e) => onUpdateCell(row.id, col.id, e.target.value)} 
                          />
                        ) : ['TEXT', 'NUMBER'].includes(col.type) ? (
                          <input className="w-full px-3 py-2 bg-transparent focus:bg-white rounded-xl outline-none border border-transparent focus:border-indigo-100 transition-all font-bold text-slate-700 text-xs" 
                            type="text" value={cellValue || ''} onChange={(e) => onUpdateCell(row.id, col.id, e.target.value)} />
                        ) : col.type === ColumnType.TIMER ? (
                          <TimerCell value={cellValue} onChange={(v) => onUpdateCell(row.id, col.id, v)} />
                        ) : col.type === ColumnType.AI_FORMULA ? (
                          <div className="flex items-center gap-2 px-1 w-full min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0" title="실시간 자동 수식">
                              <i className="fa-solid fa-calculator text-[9px]"></i>
                            </div>
                            <div className="flex-1 overflow-hidden min-w-0">
                              <SmartBadge value={cellValue} type={col.type} />
                            </div>
                          </div>
                        ) : col.type === ColumnType.AI_BUTTON ? (
                          <div className="flex items-center gap-2 px-1 w-full min-w-0">
                            <button 
                              onClick={() => col.aiConfig && onRunTool(row.id, col.id, col.aiConfig)} 
                              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${col.aiConfig ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-90' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                              title="계산 실행"
                            >
                              <i className="fa-solid fa-play text-[9px]"></i>
                            </button>
                            <div className="flex-1 overflow-hidden min-w-0">
                              <SmartBadge value={cellValue} type={col.type} />
                            </div>
                          </div>
                        ) : (
                          <div className="px-2 w-full truncate"><SmartBadge value={cellValue} /></div>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td></td>
              </tr>
            ))}
            <tr>
              <td className="p-6" colSpan={file.columns.length + 2}>
                <button onClick={onAddRow} className="group text-xs font-black text-indigo-500 hover:text-indigo-700 transition-all flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform"><i className="fa-solid fa-plus"></i></div>
                  새 데이터 행 추가
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FileView;
