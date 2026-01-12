
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { NodeType, Node, Column, ColumnType, AIConfig, Row } from './types';
import Sidebar from './components/Sidebar';
import FileView from './components/FileView';
import FolderView from './components/FolderView';
import AIToolModal from './components/AIToolModal';
import MoveNodeModal from './components/MoveNodeModal';

const STORAGE_KEY = 'OMNIDATA_EXPLORER_V1';

const INITIAL_DATA: Node = {
  id: 'root',
  parentId: null,
  name: '내 워크스페이스',
  type: NodeType.FOLDER,
  columns: [],
  rows: [],
  children: []
};

function App() {
  const [root, setRoot] = useState<Node>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  });

  const [activeNodeId, setActiveNodeId] = useState<string>('root');
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  
  const [aiModalTarget, setAiModalTarget] = useState<{ nodeId: string, colId: string, type: ColumnType } | null>(null);
  const [movingNodeId, setMovingNodeId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(root));
  }, [root]);

  const findNode = (id: string, current: Node): Node | null => {
    if (current.id === id) return current;
    if (current.children) {
      for (const child of current.children) {
        const found = findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  };

  const getPath = (id: string, current: Node, currentPath: Node[] = []): Node[] | null => {
    const path = [...currentPath, current];
    if (current.id === id) return path;
    if (current.children) {
      for (const child of current.children) {
        const found = getPath(id, child, path);
        if (found) return found;
      }
    }
    return null;
  };

  const updateNodeInTree = (tree: Node, targetId: string, updater: (node: Node) => Node): Node => {
    if (tree.id === targetId) return updater(tree);
    if (tree.children) {
      return {
        ...tree,
        children: tree.children.map(child => updateNodeInTree(child, targetId, updater))
      };
    }
    return tree;
  };

  const executeLogic = (config: AIConfig, rowData: Record<string, any>, columns: Column[], currentRoot: Node) => {
    if (!config.logicCode) return "";
    try {
      // 1. 현재 행 데이터 바인딩 (이름과 ID 모두 지원)
      const contextRow: Record<string, any> = {};
      columns.forEach(col => {
        const val = rowData[col.id];
        contextRow[col.id] = val;
        contextRow[col.name] = val;
      });

      // 2. 글로벌 헬퍼 함수
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
        'num': (v: any) => {
            const n = parseFloat(v);
            return isNaN(n) ? 0 : n;
        },
        'timerSec': (v: any) => {
          if (!v || typeof v.totalSeconds !== 'number') return 0;
          const current = v.startTime ? v.totalSeconds + Math.floor((Date.now() - v.startTime) / 1000) : v.totalSeconds;
          return current;
        },
        'timerMin': (v: any) => global.timerSec(v) / 60,
        'timerHr': (v: any) => global.timerSec(v) / 3600
      };

      // 3. 외부 단일 열 참조 (개별 필드)
      if (config.externalInputs) {
        config.externalInputs.forEach(ext => {
          const extFile = findNode(ext.nodeId, currentRoot);
          if (extFile && extFile.rows.length > 0) {
            // 기본적으로 첫 번째 행의 값을 가져오되, 향후 VLOOKUP 같은 기능을 위해 확장 가능
            global[ext.alias] = extFile.rows[0].data[ext.columnId];
          } else {
            global[ext.alias] = null;
          }
        });
      }

      // 4. 외부 파일 전체 참조 (배열)
      if (config.externalFiles) {
        config.externalFiles.forEach(ref => {
          const file = findNode(ref.nodeId, currentRoot);
          if (file) {
            global[ref.alias] = file.rows.map(r => {
              const rowMap: Record<string, any> = {};
              file.columns.forEach(c => {
                rowMap[c.name] = r.data[c.id];
                rowMap[c.id] = r.data[c.id];
              });
              return rowMap;
            });
          } else {
            global[ref.alias] = [];
          }
        });
      }

      const execute = new Function('row', 'global', `try { ${config.logicCode} } catch(e) { throw e; }`);
      return execute(contextRow, global);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  };

  const recalculateTree = useCallback((tree: Node): Node => {
    const processNode = (node: Node, currentRoot: Node): Node => {
      let newNode = { ...node };
      
      if (newNode.type === NodeType.FILE && newNode.columns.length > 0) {
        // AI 수식 열만 추출
        const formulaCols = newNode.columns.filter(c => c.type === ColumnType.AI_FORMULA && c.aiConfig);
        
        if (formulaCols.length > 0) {
          newNode.rows = newNode.rows.map(row => {
            let rowData = { ...row.data };
            // 각 행에 대해 등록된 모든 수식을 순서대로 실행
            formulaCols.forEach(col => {
              if (col.aiConfig) {
                const result = executeLogic(col.aiConfig, rowData, newNode.columns, currentRoot);
                // 결과 저장 위치 결정: 지정된 outputColumnId가 없으면 수식 열 자체에 저장
                const outputId = col.aiConfig.outputColumnId || col.id;
                rowData[outputId] = result ?? "";
              }
            });
            return { ...row, data: rowData };
          });
        }
      }

      if (newNode.children) {
        newNode.children = newNode.children.map(child => processNode(child, currentRoot));
      }
      
      return newNode;
    };

    return processNode(tree, tree);
  }, []);

  const onUpdateCell = (rid: string, cid: string, val: any) => {
    setRoot(prev => {
      const updatedValueTree = updateNodeInTree(prev, activeNodeId, n => ({
        ...n,
        rows: n.rows.map(r => r.id === rid ? { ...r, data: { ...r.data, [cid]: val } } : r)
      }));
      return recalculateTree(updatedValueTree);
    });
  };

  const handleRunTool = async (rowId: string, colId: string, config: AIConfig) => {
    setRoot(prev => {
      const updatedValueTree = updateNodeInTree(prev, activeNodeId, n => ({
        ...n,
        rows: n.rows.map(r => {
          if (r.id !== rowId) return r;
          const result = executeLogic(config, r.data, n.columns, prev);
          const outputId = config.outputColumnId || colId;
          return { ...r, data: { ...r.data, [outputId]: result ?? "" } };
        })
      }));
      return recalculateTree(updatedValueTree);
    });
  };

  const addNode = (parentId: string, type: NodeType) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newNode: Node = { 
      id, 
      parentId, 
      name: type === NodeType.FOLDER ? '새 폴더' : '데이터 파일', 
      type, 
      columns: type === NodeType.FILE ? [{ id: 'col1', name: '이름', type: ColumnType.TEXT }] : [], 
      rows: [], 
      children: type === NodeType.FOLDER ? [] : undefined 
    };
    setRoot(prev => updateNodeInTree(prev, parentId, n => ({ 
      ...n, 
      children: [...(n.children || []), newNode] 
    })));
    setActiveNodeId(id);
  };

  const deleteNode = (id: string, parentId: string) => {
    setRoot(prev => updateNodeInTree(prev, parentId, n => ({
      ...n,
      children: (n.children || []).filter(c => c.id !== id)
    })));
    if (activeNodeId === id) setActiveNodeId(parentId || 'root');
  };

  const renameNode = (id: string, name: string) => {
    setRoot(prev => updateNodeInTree(prev, id, n => ({ ...n, name })));
  };

  const handleMoveColumn = (cid: string, dir: 'left' | 'right') => {
    setRoot(prev => updateNodeInTree(prev, activeNodeId, n => {
      const idx = n.columns.findIndex(c => c.id === cid);
      if (idx === -1) return n;
      const newCols = [...n.columns];
      if (dir === 'left' && idx > 0) {
        [newCols[idx], newCols[idx-1]] = [newCols[idx-1], newCols[idx]];
      } else if (dir === 'right' && idx < newCols.length - 1) {
        [newCols[idx], newCols[idx+1]] = [newCols[idx+1], newCols[idx]];
      }
      return { ...n, columns: newCols };
    }));
  };

  const activeNode = useMemo(() => findNode(activeNodeId, root), [activeNodeId, root]);
  const activePath = useMemo(() => getPath(activeNodeId, root) || [], [activeNodeId, root]);
  const aiModalNode = useMemo(() => aiModalTarget ? findNode(aiModalTarget.nodeId, root) : null, [aiModalTarget, root]);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden relative">
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className={`fixed top-4 left-4 z-[70] p-3 bg-white border border-slate-200 rounded-2xl shadow-xl hover:bg-slate-50 transition-all ${isSidebarOpen ? 'translate-x-[240px] md:translate-x-0' : 'translate-x-0'}`}
      >
        <i className={`fa-solid ${isSidebarOpen ? 'fa-angles-left' : 'fa-bars'} text-indigo-600`}></i>
      </button>

      <div className={`fixed md:relative z-50 h-full transition-all duration-300 ease-in-out bg-white shadow-2xl md:shadow-none ${isSidebarOpen ? 'w-72 border-r border-slate-200 translate-x-0' : 'w-0 -translate-x-full md:w-0 overflow-hidden'}`}>
        <Sidebar 
          root={root} 
          activeNodeId={activeNodeId} 
          onSelectNode={(id) => { setActiveNodeId(id); if (window.innerWidth < 768) setIsSidebarOpen(false); }} 
          onAddNode={addNode} 
          onDeleteNode={deleteNode} 
          onRenameNode={renameNode} 
          onStartMove={(id) => setMovingNodeId(id)}
        />
      </div>
      
      <main className="flex-1 overflow-hidden p-4 md:p-8 flex flex-col relative">
        {activeNode?.type === NodeType.FOLDER ? (
          <FolderView 
            folder={activeNode} 
            path={activePath} 
            onSelectNode={setActiveNodeId} 
            onAddNode={addNode} 
          />
        ) : activeNode?.type === NodeType.FILE ? (
          <FileView 
            file={activeNode} 
            path={activePath} 
            activeViewId={activeViewId} 
            onSelectView={setActiveViewId} 
            onUpdateViews={(v) => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, views: v })))}
            onAddColumn={(type) => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, columns: [...n.columns, { id: Math.random().toString(36).substr(2, 9), name: '새 열', type }] })))}
            onAddRow={() => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, rows: [...n.rows, { id: Math.random().toString(36).substr(2, 9), data: {} }] })))} 
            onUpdateCell={onUpdateCell}
            onOpenToolCreator={(cid, type) => setAiModalTarget({ nodeId: activeNodeId, colId: cid, type })}
            onAddChildFile={() => addNode(activeNode.parentId || 'root', NodeType.FILE)}
            onDeleteColumn={(cid) => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, columns: n.columns.filter(c => c.id !== cid) })))}
            onRenameColumn={(cid, name) => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, columns: n.columns.map(col => col.id === cid ? { ...col, name } : col) })))}
            onMoveColumn={handleMoveColumn}
            onRunTool={handleRunTool}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-300">
            <i className="fa-solid fa-folder-open text-6xl mb-4 opacity-20"></i>
            <p className="text-lg font-bold">항목을 선택하여 시작하세요</p>
          </div>
        )}
      </main>

      {aiModalTarget && aiModalNode && (
        <AIToolModal 
          root={root}
          targetColId={aiModalTarget.colId}
          type={aiModalTarget.type}
          currentColumns={aiModalNode.columns}
          onClose={() => setAiModalTarget(null)}
          onSave={(config) => {
            setRoot(prev => {
              const updatedConfigTree = updateNodeInTree(prev, aiModalTarget.nodeId, n => ({
                ...n,
                columns: n.columns.map(c => c.id === aiModalTarget.colId ? { ...c, aiConfig: config } : c)
              }));
              // 저장 즉시 트리 전체 재계산 트리거
              return recalculateTree(updatedConfigTree);
            });
            setAiModalTarget(null);
          }}
        />
      )}

      {movingNodeId && (
        <MoveNodeModal 
          root={root}
          movingNodeId={movingNodeId}
          onClose={() => setMovingNodeId(null)}
          onConfirm={(targetParentId) => {
            const nodeToMove = findNode(movingNodeId, root);
            if (!nodeToMove) return;
            setRoot(prev => {
              const removeNode = (n: Node): Node => ({
                ...n,
                children: n.children?.filter(c => c.id !== movingNodeId).map(removeNode)
              });
              const treeWithoutNode = removeNode(prev);
              return updateNodeInTree(treeWithoutNode, targetParentId, n => ({
                ...n,
                children: [...(n.children || []), { ...nodeToMove, parentId: targetParentId }]
              }));
            });
            setMovingNodeId(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
