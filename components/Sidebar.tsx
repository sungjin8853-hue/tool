import React, { useState } from 'react';
import { Node, NodeType } from '../types';

interface SidebarProps {
  root: Node;
  activeNodeId: string | null;
  onSelectNode: (id: string) => void;
  onAddNode: (parentId: string, type: NodeType) => void;
  onDeleteNode: (id: string, parentId: string) => void;
  onRenameNode: (id: string, name: string) => void;
  onStartMove: (id: string) => void;
}

const NodeItem: React.FC<{
  node: Node, 
  depth: number, 
  activeId: string | null,
  onSelect: (id: string) => void,
  onAdd: (pid: string, t: NodeType) => void,
  onDelete: (id: string, pid: string) => void,
  onRename: (id: string, n: string) => void,
  onMove: (id: string) => void,
}> = ({ node, depth, activeId, onSelect, onAdd, onDelete, onRename, onMove }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const isFolder = node.type === NodeType.FOLDER;
  const isActive = activeId === node.id;

  return (
    <div className="select-none">
      <div 
        className={`flex items-center p-2 rounded-xl group cursor-pointer transition-all mb-0.5 
          ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:bg-slate-50 text-slate-600'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => { onSelect(node.id); if (isFolder) setIsOpen(true); }}
      >
        <span 
          className="w-5 mr-1 flex items-center justify-center cursor-pointer hover:bg-black/5 rounded"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        >
          {isFolder && (node.children?.length ?? 0) > 0 ? (
            <i className={`fa-solid fa-chevron-right text-[8px] transition-transform ${isOpen ? 'rotate-90' : ''}`}></i>
          ) : <div className="w-1 h-1 rounded-full bg-slate-300"></div>}
        </span>
        
        <i className={`fa-solid ${isFolder ? (isOpen ? 'fa-folder-open text-amber-400' : 'fa-folder text-amber-400') : 'fa-file-lines text-indigo-400'} mr-2.5 text-sm`}></i>
        
        {isEditing ? (
          <input 
            autoFocus 
            className="bg-white/20 text-inherit outline-none w-full px-2 py-0.5 rounded border border-white/30 text-xs font-bold"
            defaultValue={node.name}
            onBlur={(e) => { onRename(node.id, e.target.value); setIsEditing(false); }}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-bold truncate flex-1">{node.name}</span>
        )}
        
        <div className={`hidden group-hover:flex items-center gap-1 ml-2 ${isActive ? 'text-white/80' : 'text-slate-400'}`}>
           {isFolder && (
             <>
               <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, NodeType.FOLDER); }} className="p-1 hover:bg-black/10 rounded" title="폴더 추가"><i className="fa-solid fa-folder-plus text-[10px]"></i></button>
               <button onClick={(e) => { e.stopPropagation(); onAdd(node.id, NodeType.FILE); }} className="p-1 hover:bg-black/10 rounded" title="파일 추가"><i className="fa-solid fa-file-circle-plus text-[10px]"></i></button>
             </>
           )}
           <button onClick={(e) => { e.stopPropagation(); onMove(node.id); }} className="p-1 hover:bg-black/10 rounded" title="이동"><i className="fa-solid fa-right-to-bracket text-[10px]"></i></button>
           <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-1 hover:bg-black/10 rounded" title="이름 변경"><i className="fa-solid fa-pen text-[10px]"></i></button>
           {node.id !== 'root' && (
             <button onClick={(e) => { e.stopPropagation(); if(confirm('삭제하시겠습니까?')) onDelete(node.id, node.parentId!); }} className="p-1 hover:bg-rose-500 hover:text-white rounded" title="삭제"><i className="fa-solid fa-trash text-[10px]"></i></button>
           )}
        </div>
      </div>
      
      {isFolder && isOpen && node.children && node.children.length > 0 && (
        <div className="space-y-0.5">
          {node.children.map(child => (
            <NodeItem 
              key={child.id} 
              node={child} 
              depth={depth + 1} 
              activeId={activeId} 
              onSelect={onSelect} 
              onAdd={onAdd} 
              onDelete={onDelete} 
              onRename={onRename}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <div className="w-full flex flex-col h-full bg-white overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h1 className="text-lg font-black text-indigo-600 flex items-center gap-2">
          <i className="fa-solid fa-layer-group"></i> 탐색기
        </h1>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <NodeItem 
          node={props.root} 
          depth={0} 
          activeId={props.activeNodeId} 
          onSelect={props.onSelectNode} 
          onAdd={props.onAddNode} 
          onDelete={props.onDeleteNode} 
          onRename={props.onRenameNode}
          onMove={props.onStartMove}
        />
      </div>
      
      <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
         <button 
           onClick={() => props.onAddNode('root', NodeType.FOLDER)} 
           className="py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-sm"
         >
           <i className="fa-solid fa-folder-plus"></i> 새 폴더
         </button>
         <button 
           onClick={() => props.onAddNode('root', NodeType.FILE)} 
           className="py-3 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
         >
           <i className="fa-solid fa-file-circle-plus"></i> 새 파일
         </button>
      </div>
    </div>
  );
};

export default Sidebar;