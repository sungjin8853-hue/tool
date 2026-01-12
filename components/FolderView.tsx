
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
    <div className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden transition-all duration-500 animate-in fade-in zoom-in-95">
      <div className="p-8 md:p-10 border-b border-slate-50 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide text-[10px] font-black uppercase tracking-widest text-slate-300">
          {path.map((p, i) => (
            <React.Fragment key={p.id}>
              {i > 0 && <i className="fa-solid fa-chevron-right scale-75 opacity-30"></i>}
              <button 
                onClick={() => onSelectNode(p.id)}
                className={`hover:text-indigo-600 transition-colors whitespace-nowrap ${i === path.length - 1 ? 'text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md' : ''}`}
              >
                {p.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-300 to-amber-500 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg shadow-amber-200 animate-in slide-in-from-left-4">
              <i className="fa-solid fa-folder-open"></i>
            </div>
            <div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{folder.name}</h2>
              <p className="text-sm text-slate-400 font-bold mt-1 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                총 {folder.children?.length ?? 0}개의 항목이 포함됨
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => onAddNode(folder.id, NodeType.FOLDER)}
              className="px-6 py-3 bg-white text-slate-600 text-[11px] font-black rounded-2xl border border-slate-200 hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 transition-all flex items-center gap-3 shadow-sm active:scale-95"
            >
              <i className="fa-solid fa-folder-plus"></i> 폴더 추가
            </button>
            <button 
              onClick={() => onAddNode(folder.id, NodeType.FILE)}
              className="px-6 py-3 bg-indigo-600 text-white text-[11px] font-black rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transition-all flex items-center gap-3 active:scale-95"
            >
              <i className="fa-solid fa-file-circle-plus"></i> 파일 생성
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-slate-50/30">
        {folder.children && folder.children.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
            {folder.children.map((child) => (
              <div 
                key={child.id}
                onClick={() => onSelectNode(child.id)}
                className="group flex flex-col items-center p-6 rounded-[2rem] hover:bg-white cursor-pointer transition-all border border-transparent hover:border-slate-200 hover:shadow-2xl hover:shadow-indigo-100/50 hover:-translate-y-2"
              >
                <div className={`w-20 h-20 mb-4 flex items-center justify-center text-4xl transition-all duration-500 group-hover:scale-110 ${child.type === NodeType.FOLDER ? 'text-amber-400' : 'text-indigo-400'}`}>
                   <div className="relative">
                      <i className={`fa-solid ${child.type === NodeType.FOLDER ? 'fa-folder' : 'fa-file-lines'}`}></i>
                      {child.type === NodeType.FOLDER && (
                         <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center border border-slate-100 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                            <i className="fa-solid fa-chevron-right text-[10px] text-amber-500"></i>
                         </div>
                      )}
                   </div>
                </div>
                <span className="text-sm font-black text-slate-700 text-center line-clamp-2 w-full leading-tight group-hover:text-indigo-600 transition-colors">
                  {child.name}
                </span>
                <div className="mt-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                   <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                     {child.type === NodeType.FOLDER ? 'Enter Folder' : 'Open File'}
                   </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-200 py-20 animate-in fade-in slide-in-from-bottom-10">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
              <i className="fa-solid fa-box-open text-4xl opacity-20"></i>
            </div>
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Empty Space</p>
            <p className="text-xs text-slate-300 font-bold">새로운 폴더나 파일을 추가하여 작업을 시작하세요</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderView;
