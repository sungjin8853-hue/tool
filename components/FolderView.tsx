
import React from 'react';
import { Node, NodeType } from '../types';

interface FolderViewProps {
  folder: Node;
  path: Node[];
  onSelectNode: (id: string) => void;
  onAddNode: (parentId: string, type: NodeType) => void;
}

const FolderView: React.FC<FolderViewProps> = ({ folder, path, onSelectNode, onAddNode }) => {
  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      <div className="p-8 border-b border-slate-50">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide text-[10px] font-black uppercase tracking-widest text-slate-300">
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <i className="fa-solid fa-chevron-right scale-75 opacity-30"></i>}
              <button 
                onClick={() => onSelectNode(p.id)}
                className={`hover:text-indigo-600 transition-colors ${i === path.length - 1 ? 'text-indigo-600' : ''}`}
              >
                {p.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-400 text-2xl shadow-inner">
              <i className="fa-solid fa-folder-open"></i>
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">{folder.name}</h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                항목 {folder.children?.length ?? 0}개
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => onAddNode(folder.id, NodeType.FOLDER)}
              className="px-4 py-2 bg-slate-50 text-slate-600 text-xs font-black rounded-xl border border-slate-200 hover:bg-white hover:shadow-md transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-folder-plus"></i> 새 폴더
            </button>
            <button 
              onClick={() => onAddNode(folder.id, NodeType.FILE)}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
            >
              <i className="fa-solid fa-file-circle-plus"></i> 새 파일
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {folder.children && folder.children.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {folder.children.map((child) => (
              <div 
                key={child.id}
                onDoubleClick={() => onSelectNode(child.id)}
                onClick={() => onSelectNode(child.id)}
                className="group flex flex-col items-center p-4 rounded-2xl hover:bg-indigo-50/50 cursor-pointer transition-all border border-transparent hover:border-indigo-100"
              >
                <div className={`w-16 h-16 mb-3 flex items-center justify-center text-3xl transition-transform group-hover:scale-110 ${child.type === NodeType.FOLDER ? 'text-amber-400' : 'text-indigo-400'}`}>
                  <i className={`fa-solid ${child.type === NodeType.FOLDER ? 'fa-folder' : 'fa-file-lines'}`}></i>
                </div>
                <span className="text-xs font-bold text-slate-600 text-center line-clamp-2 w-full leading-relaxed">
                  {child.name}
                </span>
                {child.type === NodeType.FILE && (
                   <span className="text-[9px] text-slate-300 font-black uppercase mt-1">DataTable</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-200">
            <i className="fa-solid fa-box-open text-6xl mb-4 opacity-10"></i>
            <p className="text-sm font-black text-slate-300 uppercase tracking-widest">이 폴더는 비어있습니다</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderView;
