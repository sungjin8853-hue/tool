
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { NodeType, Node, Column, Row, ColumnType, AIConfig } from './types';
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

  // 로직 실행 함수 (날짜 관련 강력한 헬퍼 포함)
  const executeLogic = (config: AIConfig, rowData: Record<string, any>, columns: Column[], currentRoot: Node) => {
    if (!config.logicCode) return "";
    try {
      const contextRow: Record<string, any> = {};
      columns.forEach(col => {
        const val = rowData[col.id];
        contextRow[col.id] = val;
        contextRow[col.name] = val;
      });

      const global: Record<string, any> = {
        '오늘날짜': new Date().toISOString().split('T')[0],
        '현재시각': new Date().toLocaleTimeString(),
        'formatDate': (d: any) => {
          if (!d) return '';
          const date = new Date(d);
          return isNaN(date.getTime()) ? String(d) : date.toISOString().split('T')[0];
        },
        'diffDays': (d1: any, d2: any) => {
          if (!d1 || !d2) return 0;
          const date1 = new Date(d1);
          const date2 = new Date(d2);
          const diffTime = date2.getTime() - date1.getTime();
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        },
        'isToday': (d: any) => {
          if (!d) return false;
          const target = new Date(d).toISOString().split('T')[0];
          const today = new Date().toISOString().split('T')[0];
          return target === today;
        },
        'addDays': (d: any, days: number) => {
          if (!d) return '';
          const date = new Date(d);
          date.setDate(date.getDate() + days);
          return date.toISOString().split('T')[0];
        },
        'isPast': (d: any) => {
          if (!d) return false;
          return new Date(d).getTime() < new Date().setHours(0,0,0,0);
        },
        'isFuture': (d: any) => {
          if (!d) return false;
          return new Date(d).getTime() > new Date().setHours(23,59,59,999);
        }
      };

      // 외부 데이터 참조 주입
      if (config.externalInputs) {
        config.externalInputs.forEach(ext => {
          const extFile = findNode(ext.nodeId, currentRoot);
          if (extFile && extFile.rows.length > 0) {
            global[ext.alias] = extFile.rows[0].data[ext.columnId];
          }
        });
      }

      const execute = new Function('row', 'global', `try { ${config.logicCode} } catch(e) { throw e; }`);
      return execute(contextRow, global);
    } catch (e) {
      return `Error: ${(e as Error).message}`;
    }
  };

  const onUpdateCell = (rid: string, cid: string, val: any) => {
    setRoot(prev => updateNodeInTree(prev, activeNodeId, n => {
      const rowsWithNewValue = n.rows.map(r => r.id === rid ? { ...r, data: { ...r.data, [cid]: val } } : r);
      const updatedRows = rowsWithNewValue.map(row => {
        let rowData = { ...row.data };
        n.columns.forEach(col => {
          if (col.type === ColumnType.AI_FORMULA && col.aiConfig) {
            const result = executeLogic(col.aiConfig, rowData, n.columns, prev);
            const outputId = col.aiConfig.outputColumnId || col.id;
            rowData[outputId] = result ?? "";
          }
        });
        return { ...row, data: rowData };
      });
      return { ...n, rows: updatedRows };
    }));
  };

  const handleRunTool = async (rowId: string, colId: string, config: AIConfig) => {
    setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({
      ...n,
      rows: n.rows.map(r => {
        if (r.id !== rowId) return r;
        const result = executeLogic(config, r.data, n.columns, prev);
        const outputId = config.outputColumnId || colId;
        return { ...r, data: { ...r.data, [outputId]: result ?? "" } };
      })
    })));
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

  const handleMoveNode = (targetParentId: string) => {
    if (!movingNodeId) return;
    const nodeToMove = findNode(movingNodeId, root);
    if (!nodeToMove) return;

    setRoot(prev => {
      const removeNodeFromTree = (n: Node): Node => {
        const updatedChildren = n.children ? n.children.filter(c => c.id !== movingNodeId).map(removeNodeFromTree) : undefined;
        return { ...n, children: updatedChildren };
      };
      const treeWithoutNode = removeNodeFromTree(prev);
      return updateNodeInTree(treeWithoutNode, targetParentId, n => ({
        ...n,
        children: [...(n.children || []), { ...nodeToMove, parentId: targetParentId }]
      }));
    });
    setMovingNodeId(null);
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
            onRenameColumn={(cid, name) => setRoot(prev => updateNodeInTree(prev, activeNodeId, n => ({ ...n, columns: n.columns.map(c => c.id === cid ? { ...c, name } : c) })))}
            onMoveColumn={() => {}}
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
            setRoot(prev => updateNodeInTree(prev, aiModalTarget.nodeId, n => {
              const updatedColumns = n.columns.map(c => c.id === aiModalTarget.colId ? { ...c, aiConfig: config } : c);
              const updatedRows = n.rows.map(row => {
                let rowData = { ...row.data };
                updatedColumns.forEach(col => {
                  if (col.type === ColumnType.AI_FORMULA && col.aiConfig) {
                    const result = executeLogic(col.aiConfig, rowData, updatedColumns, prev);
                    const outputId = col.aiConfig.outputColumnId || col.id;
                    rowData[outputId] = result ?? "";
                  }
                });
                return { ...row, data: rowData };
              });
              return { ...n, columns: updatedColumns, rows: updatedRows };
            }));
            setAiModalTarget(null);
          }}
        />
      )}

      {movingNodeId && (
        <MoveNodeModal 
          root={root}
          movingNodeId={movingNodeId}
          onClose={() => setMovingNodeId(null)}
          onConfirm={handleMoveNode}
        />
      )}
    </div>
  );
}

export default App;
