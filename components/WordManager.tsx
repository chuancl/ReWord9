
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { WordCategory, WordEntry, MergeStrategyConfig, WordTab, Scenario, AppView } from '../types';
import { DEFAULT_MERGE_STRATEGY } from '../constants';
import { Upload, Download, Filter, Settings2, List, Search, Plus, Trash2, CheckSquare, Square, ArrowRight, BookOpen, GraduationCap, CheckCircle, RotateCcw, FileDown, ChevronDown, Binary } from 'lucide-react';
import { MergeConfigModal } from './word-manager/MergeConfigModal';
import { AddWordModal } from './word-manager/AddWordModal';
import { WordList } from './word-manager/WordList';
import { Toast, ToastMessage } from './ui/Toast';
import { entriesStorage } from '../utils/storage';
import { browser } from 'wxt/browser';

const Tooltip: React.FC<{ text: string; children: React.ReactNode }> = ({ text, children }) => {
  return (
    <div className="group relative flex items-center">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-slate-800 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-pre-line text-center shadow-xl leading-relaxed min-w-[120px]">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  );
};

// --- Standard Import Template (Comprehensive & Updated) ---
const IMPORT_TEMPLATE = [
  {
    "text": "serendipity",
    "translation": "机缘凑巧; 意外发现珍奇事物的本领",
    "phoneticUs": "/ˌsɛrənˈdɪpɪti/",
    "phoneticUk": "/ˌsɛrənˈdɪpɪti/",
    "partOfSpeech": "n.",
    "englishDefinition": "The occurrence and development of events by chance in a happy or beneficial way.",
    "dictionaryExample": "Nature has created wonderful things by serendipity.",
    "dictionaryExampleTranslation": "大自然通过机缘巧合创造了奇妙的事物。",
    "contextSentence": "It was pure serendipity that we met.",
    "contextSentenceTranslation": "我们相遇纯属机缘巧合。",
    "mixedSentence": "It was pure serendipity (机缘巧合) that we met.",
    "inflections": ["serendipities", "serendipitous"],
    "tags": ["CET6", "GRE", "Literary"],
    "importance": 3,
    "cocaRank": 15000,
    "phrases": [
      { "text": "pure serendipity", "trans": "纯属巧合" }
    ],
    "roots": [
      { "root": "serendip", "words": [{ "text": "serendipitous", "trans": "偶然的" }] }
    ],
    "synonyms": [
      { "text": "chance", "trans": "机会" },
      { "text": "fluke", "trans": "侥幸" }
    ],
    "image": "https://example.com/image.jpg",
    "video": {
        "title": "单词讲解视频",
        "url": "https://example.com/video.mp4",
        "cover": "https://example.com/cover.jpg"
    },
    "sourceUrl": "https://en.wikipedia.org/wiki/Serendipity"
  },
  {
    "_说明": "本行仅为字段说明，导入时将被忽略。请确保 JSON 格式正确。",
    "text": "【必填】单词拼写",
    "translation": "【建议填写】中文释义",
    "phoneticUs": "选填。美式音标",
    "phoneticUk": "选填。英式音标",
    "partOfSpeech": "选填。词性简写 (n. v. adj. adv. 等)",
    "englishDefinition": "选填。英文定义",
    "dictionaryExample": "选填。词典标准例句",
    "dictionaryExampleTranslation": "选填。例句翻译",
    "contextSentence": "选填。网页原句 (Context)",
    "contextSentenceTranslation": "选填。网页原句翻译",
    "mixedSentence": "选填。中英混合例句（单词替换后的中文句）",
    "inflections": "选填。字符串数组。单词的变形列表，用于网页自动匹配。",
    "tags": "选填。字符串数组。标签（如: ['CET4', 'SAT']）",
    "importance": "选填。数字 (1-5)。柯林斯星级。",
    "cocaRank": "选填。数字。COCA 词频排名。",
    "phrases": "选填。对象数组。格式: [{ 'text': '短语', 'trans': '释义' }]",
    "roots": "选填。对象数组。格式: [{ 'root': '词根', 'words': [{ 'text': '同根词', 'trans': '释义' }] }]",
    "synonyms": "选填。对象数组。格式: [{ 'text': '近义词', 'trans': '释义' }]",
    "image": "选填。配图链接 (URL)",
    "video": "选填。对象。包含 { 'title', 'url', 'cover' }",
    "sourceUrl": "选填。维基百科或来源参考地址 (URL)"
  }
];

interface WordManagerProps {
  scenarios: Scenario[];
  entries: WordEntry[];
  setEntries: React.Dispatch<React.SetStateAction<WordEntry[]>>;
  ttsSpeed?: number;
  initialTab?: WordTab;
  initialSearchQuery?: string;
  onOpenDetail?: (word: string) => void; 
}

export const WordManager: React.FC<WordManagerProps> = ({ 
    scenarios, 
    entries, 
    setEntries, 
    ttsSpeed = 1.0,
    initialTab,
    initialSearchQuery,
    onOpenDetail
}) => {
  const [activeTab, setActiveTab] = useState<WordTab>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());

  const [isImportDropdownOpen, setIsImportDropdownOpen] = useState(false);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      if (initialTab) setActiveTab(initialTab);
      if (initialSearchQuery !== undefined) setSearchQuery(initialSearchQuery);
  }, [initialTab, initialSearchQuery]);

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [showConfig, setShowConfig] = useState({
    showPhonetic: true,
    showMeaning: true,
  });
  
  const [mergeConfig, setMergeConfig] = useState<MergeStrategyConfig>(DEFAULT_MERGE_STRATEGY);
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  useEffect(() => {
     const savedConfigStr = localStorage.getItem('context-lingo-merge-config');
     if (savedConfigStr) {
         try {
             const saved = JSON.parse(savedConfigStr);
             let needsUpdate = false;
             
             const requiredItems = [
                 { id: 'inflections', label: '词态变化 (Morphology)' },
                 { id: 'phrases', label: '常用短语 (Phrases)' },
                 { id: 'roots', label: '词根词缀 (Roots)' },
                 { id: 'synonyms', label: '近义词 (Synonyms)' }
             ];

             requiredItems.forEach(req => {
                 if (!saved.exampleOrder.some((item: any) => item.id === req.id)) {
                     saved.exampleOrder.push({ ...req, enabled: true });
                     needsUpdate = true;
                 }
             });

             if (typeof saved.showPartOfSpeech === 'undefined') { saved.showPartOfSpeech = true; needsUpdate = true; }
             if (typeof saved.showTags === 'undefined') { saved.showTags = true; needsUpdate = true; }
             if (typeof saved.showImportance === 'undefined') { saved.showImportance = true; needsUpdate = true; }
             if (typeof saved.showCocaRank === 'undefined') { saved.showCocaRank = true; needsUpdate = true; }
             if (typeof saved.showImage === 'undefined') { saved.showImage = true; needsUpdate = true; }
             if (typeof saved.showVideo === 'undefined') { saved.showVideo = true; needsUpdate = true; }
             
             if (typeof saved.showExampleTranslation === 'undefined') { saved.showExampleTranslation = true; needsUpdate = true; }
             if (typeof saved.showContextTranslation === 'undefined') { saved.showContextTranslation = true; needsUpdate = true; }

             if (needsUpdate) {
                 localStorage.setItem('context-lingo-merge-config', JSON.stringify(saved));
             }
             setMergeConfig(saved);
         } catch (e) {
             console.error("Failed to load merge config", e);
             setMergeConfig(DEFAULT_MERGE_STRATEGY);
         }
     } else {
         setMergeConfig(DEFAULT_MERGE_STRATEGY);
         localStorage.setItem('context-lingo-merge-config', JSON.stringify(DEFAULT_MERGE_STRATEGY));
     }
  }, []);

  useEffect(() => {
      localStorage.setItem('context-lingo-merge-config', JSON.stringify(mergeConfig));
  }, [mergeConfig]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (importDropdownRef.current && !importDropdownRef.current.contains(event.target as Node)) {
              setIsImportDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSelectedWords(new Set());
  }, [activeTab, selectedScenarioId]);

  useEffect(() => {
    if (selectedScenarioId !== 'all' && !scenarios.find(s => s.id === selectedScenarioId)) {
      setSelectedScenarioId('all');
    }
  }, [scenarios, selectedScenarioId]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
      setToast({ id: Date.now(), message, type });
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (activeTab !== 'all') {
        if (e.category !== activeTab) return false;
      }
      if (selectedScenarioId !== 'all') {
         if (e.scenarioId !== selectedScenarioId) return false;
      }
      if (searchQuery) {
        const lowerQ = searchQuery.toLowerCase();
        const matchText = e.text.toLowerCase().includes(lowerQ);
        const matchTrans = e.translation?.toLowerCase().includes(lowerQ) || false;
        if (!matchText && !matchTrans) return false;
      }
      return true; 
    });
  }, [entries, activeTab, selectedScenarioId, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups: Record<string, WordEntry[]> = {};
    filteredEntries.forEach(entry => {
      let key = entry.text.toLowerCase().trim();
      if (mergeConfig.strategy === 'by_word_and_meaning') {
        key = `${key}::${entry.translation?.trim()}`;
      }
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(entry);
    });
    const sortedGroups = Object.values(groups).map(group => {
       return group.sort((a, b) => b.addedAt - a.addedAt);
    });
    return sortedGroups.sort((a, b) => {
       const maxA = a[0].addedAt; 
       const maxB = b[0].addedAt;
       return maxB - maxA;
    });
  }, [filteredEntries, mergeConfig.strategy]);

  const allVisibleIds = useMemo(() => filteredEntries.map(e => e.id), [filteredEntries]);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedWords.has(id));
  const isAllWordsTab = activeTab === 'all';

  const toggleSelectAll = () => {
    if (allSelected) {
      const newSet = new Set(selectedWords);
      allVisibleIds.forEach(id => newSet.delete(id));
      setSelectedWords(newSet);
    } else {
      const newSet = new Set(selectedWords);
      allVisibleIds.forEach(id => newSet.add(id));
      setSelectedWords(newSet);
    }
  };

  const toggleSelectGroup = (group: WordEntry[]) => {
    const newSet = new Set(selectedWords);
    const groupIds = group.map(g => g.id);
    const isGroupSelected = groupIds.every(id => newSet.has(id));

    if (isGroupSelected) {
      groupIds.forEach(id => newSet.delete(id));
    } else {
      groupIds.forEach(id => newSet.add(id));
    }
    setSelectedWords(newSet);
  };

  const isGroupSelected = (group: WordEntry[]) => {
    return group.every(e => selectedWords.has(e.id));
  };

  const handleDeleteSelected = () => {
    if (selectedWords.size === 0) return;

    if (confirm(`确定从当前列表删除选中的 ${selectedWords.size} 个单词吗？`)) {
      setEntries(prev => prev.filter(e => !selectedWords.has(e.id)));
      setSelectedWords(new Set());
      showToast('删除成功', 'success');
    }
  };

  const handleBatchMove = (targetCategory: WordCategory) => {
      if (selectedWords.size === 0) return;
      const newEntries = entries.map(e => {
          if (selectedWords.has(e.id)) {
              return { ...e, category: targetCategory };
          }
          return e;
      });
      setEntries(newEntries);
      setSelectedWords(new Set());
      showToast('移动成功', 'success');
  };

  const handleExport = () => {
     let dataToExport: WordEntry[];
     if (selectedWords.size > 0) {
        dataToExport = entries.filter(e => selectedWords.has(e.id));
     } else {
        dataToExport = filteredEntries;
     }

     if (dataToExport.length === 0) {
        showToast('当前列表为空，无法导出', 'warning');
        return;
     }

     const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     const prefix = selectedWords.size > 0 ? 'selected' : activeTab;
     a.download = `reword_export_${prefix}_${dataToExport.length}words_${Date.now()}.json`;
     document.body.appendChild(a);
     a.click();
     document.body.removeChild(a);
     URL.revokeObjectURL(url);
     showToast(`成功导出 ${dataToExport.length} 个单词`, 'success');
  };

  const handleDownloadTemplate = () => {
      const blob = new Blob([JSON.stringify(IMPORT_TEMPLATE, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'reword_import_template.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('模板已下载', 'success');
      setIsImportDropdownOpen(false);
  };

  const triggerImport = () => {
     if (fileInputRef.current) fileInputRef.current.click();
     setIsImportDropdownOpen(false);
  };

  const handleOpenBatchGenerator = () => {
      const url = (browser.runtime as any).getURL('/batch-generator.html');
      window.open(url, '_blank');
      setIsImportDropdownOpen(false);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = async (event) => {
        const text = event.target?.result as string;
        let candidates: any[] = [];
        
        try {
           candidates = JSON.parse(text);
           if (!Array.isArray(candidates)) {
               throw new Error("JSON Root is not an array");
           }
        } catch (err) {
           showToast("文件格式错误：仅支持符合模板规范的 JSON 文件。", "error");
           e.target.value = ''; 
           return;
        }

        const targetCategory = activeTab === 'all' ? WordCategory.WantToLearnWord : activeTab;
        let successCount = 0;
        let failCount = 0;
        const newEntriesToAdd: WordEntry[] = [];

        const isDuplicate = (t: string, trans?: string) => {
            return entries.some(e => e.text.toLowerCase() === t.toLowerCase() && (e.translation?.trim() === trans?.trim()));
        };

        for (const candidate of candidates) {
            if (!candidate.text || typeof candidate.text !== 'string' || candidate.text.includes('必填')) continue;
            if (isDuplicate(candidate.text, candidate.translation)) { failCount++; continue; }

            newEntriesToAdd.push({
                ...candidate,
                id: `import-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                category: targetCategory,
                addedAt: Date.now(),
                scenarioId: selectedScenarioId === 'all' ? '1' : selectedScenarioId
            });
            successCount++;
        }

        if (newEntriesToAdd.length > 0) {
            setEntries(prev => [...prev, ...newEntriesToAdd]);
            showToast(`导入完成: 新增 ${successCount}`, 'success');
        } else {
             showToast(`导入结束: 没有新增单词`, 'warning');
        }
     };
     reader.readAsText(file);
     e.target.value = ''; 
  };

  const handleAddWord = async (entryData: Partial<WordEntry>) => {
      const isDuplicate = entries.some(e => e.text.toLowerCase() === entryData.text?.toLowerCase());
      if (isDuplicate) { showToast(`单词已存在`, 'warning'); return; }

      const targetCategory = entryData.category || (activeTab === 'all' ? WordCategory.WantToLearnWord : activeTab);
      const newEntry: WordEntry = {
          ...entryData,
          id: `manual-${Date.now()}`,
          text: entryData.text!,
          category: targetCategory,
          addedAt: Date.now(),
          scenarioId: '1',
      } as WordEntry;

      setEntries(prev => [newEntry, ...prev]);
      showToast('添加成功', 'success');
  };

  const handleDragStart = (index: number) => setDraggedItemIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;
    const newOrder = [...mergeConfig.exampleOrder];
    const draggedItem = newOrder[draggedItemIndex];
    newOrder.splice(draggedItemIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setMergeConfig({ ...mergeConfig, exampleOrder: newOrder });
    setDraggedItemIndex(index);
  };
  const handleDragEnd = () => setDraggedItemIndex(null);
  
  const getTabLabel = (tab: WordTab) => tab === 'all' ? '所有单词' : tab;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative min-h-[600px]">
      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImportFile} />
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="border-b border-slate-200 px-6 py-5 bg-slate-50 rounded-t-xl flex justify-between items-center flex-wrap gap-4">
        <div><h2 className="text-xl font-bold text-slate-800">词汇库管理</h2><p className="text-sm text-slate-500 mt-1">管理、筛选及编辑您的个性化词库</p></div>
        <Tooltip text="配置显示内容及排序"><button onClick={() => setIsMergeModalOpen(true)} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition shadow-sm shadow-blue-200"><Settings2 className="w-4 h-4 mr-2" /> 显示配置</button></Tooltip>
      </div>
      
      <AddWordModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onConfirm={handleAddWord} initialCategory={activeTab === 'all' ? WordCategory.WantToLearnWord : activeTab} />
      <MergeConfigModal isOpen={isMergeModalOpen} onClose={() => setIsMergeModalOpen(false)} mergeConfig={mergeConfig} setMergeConfig={setMergeConfig} showConfig={showConfig} setShowConfig={setShowConfig} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDragEnd={handleDragEnd} draggedItemIndex={draggedItemIndex} />

      <div className="border-b border-slate-200 bg-white p-4 space-y-4">
        <div className="flex overflow-x-auto gap-2 pb-2 hide-scrollbar">
          {(['all', ...Object.values(WordCategory)] as WordTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap transition-all ${activeTab === tab ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{getTabLabel(tab)}</button>
          ))}
        </div>
        
        <div className="flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 p-3 rounded-xl border border-slate-100">
           <div className="flex items-center gap-4 flex-1">
              <button onClick={toggleSelectAll} className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900">{allSelected ? <CheckSquare className="w-5 h-5 mr-2 text-blue-600"/> : <Square className="w-5 h-5 mr-2 text-slate-400"/>}全选</button>
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4"><Filter className="w-4 h-4 text-slate-400" /><select value={selectedScenarioId} onChange={(e) => setSelectedScenarioId(e.target.value)} className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer rounded"><option value="all">所有场景</option>{scenarios.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}</select></div>
              <div className="flex items-center space-x-2 border-l border-slate-200 pl-4 flex-1 max-w-xs"><Search className="w-4 h-4 text-slate-400" /><input type="text" placeholder="搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full text-sm border-none bg-transparent focus:ring-0 text-slate-700" /></div>
           </div>
           <div className="flex gap-2 items-center">
              {selectedWords.size > 0 ? (
                 <><button onClick={handleExport} className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition"><Download className="w-4 h-4 mr-2" /> 导出 ({selectedWords.size})</button><button onClick={handleDeleteSelected} className="flex items-center px-3 py-1.5 text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition"><Trash2 className="w-4 h-4 mr-2" /> 删除</button></>
              ) : (
                  <><button onClick={() => setIsAddModalOpen(true)} className="flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 transition"><Plus className="w-4 h-4 mr-2" /> 新增</button>
                    <div className="relative inline-flex items-stretch" ref={importDropdownRef}><button onClick={triggerImport} className="flex items-center px-3 py-1.5 text-sm font-bold text-blue-600 bg-white border border-slate-200 rounded-l-lg hover:bg-blue-50 transition border-r-0"><Upload className="w-4 h-4 mr-2" /> 批量导入</button><button onClick={() => setIsImportDropdownOpen(!isImportDropdownOpen)} className={`flex items-center px-1.5 border border-slate-200 rounded-r-lg hover:bg-slate-50 transition-all ${isImportDropdownOpen ? 'bg-slate-100' : 'bg-white'}`}><ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isImportDropdownOpen ? 'rotate-180' : ''}`} /></button>
                    {isImportDropdownOpen && (<div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden"><div className="px-4 py-2 border-b border-slate-50 mb-1"><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">导入选项</span></div><button onClick={handleDownloadTemplate} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group"><div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-100"><FileDown className="w-4 h-4" /></div><div className="flex flex-col text-left"><span className="text-sm font-bold text-slate-700">下载导入模板</span><span className="text-[10px] text-slate-400">标准 JSON 格式。</span></div></button><button onClick={handleOpenBatchGenerator} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group border-t border-slate-50"><div className="p-2 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-100"><Binary className="w-4 h-4" /></div><div className="flex flex-col text-left"><span className="text-sm font-bold text-slate-700">生成批导数据</span><span className="text-[10px] text-slate-400">配置路径，自定义映射。</span></div></button></div>)}</div></>
              )}
           </div>
        </div>
      </div>

      <div className="bg-slate-50 p-4 space-y-4 flex-1">
        <WordList groupedEntries={groupedEntries} selectedWords={selectedWords} toggleSelectGroup={toggleSelectGroup} isGroupSelected={isGroupSelected} showConfig={showConfig} mergeConfig={mergeConfig} isAllWordsTab={isAllWordsTab} searchQuery={searchQuery} ttsSpeed={ttsSpeed} onOpenDetail={onOpenDetail} />
      </div>
    </div>
  );
};
