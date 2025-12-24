
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
    Play, Download, Trash2, ChevronRight, ChevronDown, List, MapPin, 
    Database, Send, AlertCircle, Code, Save, RotateCcw, RotateCw, 
    Eraser, LayoutGrid, FileJson, CheckSquare, Square, Plus, 
    CheckCircle, BookOpen, GraduationCap, Loader2 
} from 'lucide-react';
import { Logo } from './Logo';
import { Toast, ToastMessage } from './ui/Toast';
import { WordCategory, WordEntry } from '../types';
import { entriesStorage } from '../utils/storage';

// 映射可用字段
const MAPPING_FIELDS = [
    { id: 'text', label: '单词拼写 (text)' },
    { id: 'translation', label: '中文释义 (translation)' },
    { id: 'phoneticUs', label: '美式音标 (phoneticUs)' },
    { id: 'phoneticUk', label: '英式音标 (phoneticUk)' },
    { id: 'partOfSpeech', label: '词性 (partOfSpeech)' },
    { id: 'englishDefinition', label: '英文定义 (englishDefinition)' },
    { id: 'contextSentence', label: '例句 (contextSentence)' },
    { id: 'contextSentenceTranslation', label: '例句翻译 (contextSentenceTranslation)' },
    { id: 'tags', label: '标签 (tags)', type: 'array' },
    { id: 'importance', label: '重要程度 (importance)', type: 'number' },
    { id: 'cocaRank', label: 'COCA排名 (cocaRank)', type: 'number' }
];

interface MappingConfig {
    path: string;
    field: string;
}

interface ListConfig {
    path: string;
}

interface HistoryStep {
    mappings: MappingConfig[];
    lists: ListConfig[];
}

export const BatchDataGenerator: React.FC = () => {
    const [apiUrl, setApiUrl] = useState('https://dict.youdao.com/jsonapi?q={word}');
    const [wordsInput, setWordsInput] = useState('book, apple, banana');
    const [jsonData, setJsonData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // 配置状态
    const [mappings, setMappings] = useState<MappingConfig[]>([]);
    const [lists, setLists] = useState<ListConfig[]>([]);
    
    // 历史管理
    const [history, setHistory] = useState<HistoryStep[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // 预览状态
    const [previewMode, setPreviewMode] = useState<'json' | 'cards'>('cards');
    const [previewResult, setPreviewResult] = useState<any[] | null>(null);
    const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<number>>(new Set());
    
    // UI 展开状态
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']));
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const showToast = (message: string, type: ToastMessage['type'] = 'success') => setToast({ id: Date.now(), message, type });

    // 记录历史
    const saveHistory = (m: MappingConfig[], l: ListConfig[]) => {
        const newStep = { mappings: [...m], lists: [...l] };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newStep);
        if (newHistory.length > 50) newHistory.shift(); // 限制50步
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => {
        if (historyIndex > 0) {
            const prev = history[historyIndex - 1];
            setMappings(prev.mappings);
            setLists(prev.lists);
            setHistoryIndex(historyIndex - 1);
        }
    };

    const redo = () => {
        if (historyIndex < history.length - 1) {
            const next = history[historyIndex + 1];
            setMappings(next.mappings);
            setLists(next.lists);
            setHistoryIndex(historyIndex + 1);
        }
    };

    const clearAllSelections = () => {
        setMappings([]);
        setLists([]);
        saveHistory([], []);
        showToast('已清空所有规则', 'info');
    };

    // 初始化历史
    useEffect(() => {
        if (historyIndex === -1) saveHistory([], []);
    }, []);

    const normalizePath = (path: string) => path.replace(/\.\d+/g, '');

    const fetchTemplateData = async () => {
        const firstWord = wordsInput.split(/[,，]/)[0]?.trim();
        if (!firstWord) {
            showToast('请输入至少一个单词', 'error');
            return;
        }
        setIsFetching(true);
        try {
            const url = apiUrl.replace('{word}', encodeURIComponent(firstWord));
            const response = await fetch(url);
            const data = await response.json();
            setJsonData(data);
            showToast(`已获取单词 "${firstWord}" 的结构用于规则配置`, 'success');
        } catch (e: any) {
            showToast(`请求失败: ${e.message}`, 'error');
        } finally {
            setIsFetching(false);
        }
    };

    const toggleExpand = (path: string) => {
        const next = new Set(expandedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpandedPaths(next);
    };

    const isListPath = (path: string) => lists.some(l => l.path === normalizePath(path));
    const getMappingField = (path: string) => mappings.find(m => m.path === normalizePath(path))?.field;

    const toggleList = (path: string) => {
        const nPath = normalizePath(path);
        let newLists;
        if (lists.some(l => l.path === nPath)) {
            newLists = lists.filter(l => l.path !== nPath);
        } else {
            newLists = [...lists, { path: nPath }];
        }
        setLists(newLists);
        saveHistory(mappings, newLists);
    };

    const setMapping = (path: string, field: string) => {
        const nPath = normalizePath(path);
        let newMappings;
        if (!field) {
            newMappings = mappings.filter(m => m.path !== nPath);
        } else {
            const existing = mappings.find(m => m.path === nPath);
            if (existing) {
                newMappings = mappings.map(m => m.path === nPath ? { ...m, field } : m);
            } else {
                newMappings = [...mappings, { path: nPath, field }];
            }
        }
        setMappings(newMappings);
        saveHistory(newMappings, lists);
    };

    // 树形渲染
    const renderNode = (key: string, value: any, path: string, depth: number) => {
        const isObject = value !== null && typeof value === 'object';
        const isExpanded = expandedPaths.has(path);
        const mappedField = getMappingField(path);
        const isList = isListPath(path);

        return (
            <div key={path} className="select-none">
                <div 
                    className={`flex items-center gap-2 py-1 px-3 rounded-xl transition-all group mb-1 border
                        ${isList ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-100' : 
                          mappedField ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    {isObject ? (
                        <button onClick={() => toggleExpand(path)} className="p-1 hover:bg-white rounded-md shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6 shrink-0" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold shrink-0 ${isList ? 'text-purple-700' : mappedField ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        {!isObject && (
                            <span className="text-sm text-slate-400 truncate font-mono italic" title={String(value)}>: {typeof value === 'string' ? `"${value}"` : String(value)}</span>
                        )}
                    </div>

                    <div className={`flex items-center gap-2 shrink-0 ${isList || mappedField ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                            onClick={() => toggleList(path)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border
                                ${isList ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white text-slate-400 border-slate-200 hover:border-purple-400'}`}
                        >
                            <List className="w-3 h-3" /> {isList ? 'LIST ITEM' : 'SET LIST'}
                        </button>
                        <select 
                            value={mappedField || ''}
                            onChange={(e) => setMapping(path, e.target.value)}
                            className={`text-[10px] font-bold h-7 rounded-lg border outline-none px-2 
                                ${mappedField ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}
                        >
                            <option value="">MAP FIELD...</option>
                            {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                </div>
                {isObject && isExpanded && (
                    <div className="border-l-2 border-slate-100 ml-4.5 my-0.5">
                        {Object.entries(value).map(([k, v]) => renderNode(k, v, `${path}.${k}`, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    /**
     * 执行全量生成
     */
    const generateAll = async () => {
        const words = wordsInput.split(/[,，]/).map(w => w.trim()).filter(Boolean);
        if (words.length === 0) return;

        setIsGenerating(true);
        const allResults: any[] = [];
        const mappingMap = new Map(mappings.map(m => [m.path, m.field]));
        const listSet = new Set(lists.map(l => l.path));

        try {
            for (const word of words) {
                const url = apiUrl.replace('{word}', encodeURIComponent(word));
                const res = await fetch(url);
                const data = await res.json();

                const resultsForThisWord: any[] = [];

                const walk = (d: any, currentPath: string, context: any) => {
                    const nPath = normalizePath(currentPath);
                    const isListMarker = listSet.has(nPath);
                    const mappedField = mappingMap.get(nPath);

                    let currentContext = { ...context };
                    if (mappedField) currentContext[mappedField] = d;

                    if (isListMarker && d) {
                        const items = Array.isArray(d) ? d : [d];
                        items.forEach((item, idx) => {
                            const subPath = Array.isArray(d) ? `${currentPath}.${idx}` : currentPath;
                            processBranch(item, subPath, { ...currentContext });
                        });
                    } else if (typeof d === 'object' && d !== null) {
                        Object.keys(d).forEach(k => {
                            const childPath = `${currentPath}.${k}`;
                            const childNPath = normalizePath(childPath);
                            const childField = mappingMap.get(childNPath);
                            if (childField && !listSet.has(childNPath) && typeof d[k] !== 'object') {
                                currentContext[childField] = d[k];
                            }
                        });
                        Object.keys(d).forEach(k => {
                            const childPath = `${currentPath}.${k}`;
                            if (listSet.has(normalizePath(childPath)) || typeof d[k] === 'object') {
                                walk(d[k], childPath, currentContext);
                            }
                        });
                    }
                };

                const processBranch = (d: any, currentPath: string, branchContext: any) => {
                    const nPath = normalizePath(currentPath);
                    const mappedField = mappingMap.get(nPath);
                    if (mappedField) branchContext[mappedField] = d;

                    if (typeof d === 'object' && d !== null) {
                        Object.keys(d).forEach(k => {
                            const cp = `${currentPath}.${k}`;
                            const cnp = normalizePath(cp);
                            const f = mappingMap.get(cnp);
                            if (f && !listSet.has(cnp)) branchContext[f] = d[k];
                        });
                        
                        let hasDeepList = Object.keys(d).some(k => listSet.has(normalizePath(`${currentPath}.${k}`)));
                        if (hasDeepList) {
                            walk(d, currentPath, branchContext);
                        } else {
                            const collect = (innerD: any, innerP: string) => {
                                if (typeof innerD === 'object' && innerD !== null) {
                                    Object.entries(innerD).forEach(([k, v]) => {
                                        const sp = `${innerP}.${k}`;
                                        const f = mappingMap.get(normalizePath(sp));
                                        if (f) branchContext[f] = v;
                                        collect(v, sp);
                                    });
                                }
                            };
                            collect(d, currentPath);
                            pushResult(branchContext);
                        }
                    } else {
                        pushResult(branchContext);
                    }
                };

                const pushResult = (entry: any) => {
                    if (!entry.text) entry.text = word;
                    if (Object.keys(entry).length > 1) {
                        resultsForThisWord.push({ ...entry, _temp_id: Math.random() });
                    }
                };

                walk(data, 'root', {});
                allResults.push(...resultsForThisWord);
            }

            setPreviewResult(allResults);
            setSelectedPreviewIds(new Set(allResults.map((_, i) => i))); // 默认全选
            showToast(`生成完成：共处理 ${words.length} 个单词，生成 ${allResults.length} 条数据`, 'success');
        } catch (e: any) {
            showToast(`生成过程出错: ${e.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    // 导入正式词库
    const handleImportToStorage = async (category: WordCategory) => {
        if (!previewResult || selectedPreviewIds.size === 0) return;
        
        const selectedEntries = previewResult.filter((_, idx) => selectedPreviewIds.has(idx));
        const currentEntries = await entriesStorage.getValue();
        
        const newEntries: WordEntry[] = selectedEntries.map(item => ({
            ...item,
            id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category,
            addedAt: Date.now(),
            scenarioId: '1',
            inflections: item.inflections || [],
            tags: item.tags || []
        }));

        await entriesStorage.setValue([...currentEntries, ...newEntries]);
        showToast(`成功导入 ${newEntries.length} 个单词到 "${category}"`, 'success');
        
        // 导入后移除已导入的预览项
        setPreviewResult(previewResult.filter((_, idx) => !selectedPreviewIds.has(idx)));
        setSelectedPreviewIds(new Set());
    };

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
            <header className="bg-white border-b border-slate-200 px-8 h-24 flex items-center justify-between shrink-0 shadow-sm z-50">
                <Logo />
                <div className="flex-1 max-w-4xl mx-12">
                    <div className="flex flex-col gap-2">
                        <div className="flex gap-4">
                            <div className="flex-1 flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <div className="flex items-center px-4 py-2 gap-3 border-r border-slate-200">
                                    <MapPin className="w-4 h-4 text-blue-500" />
                                    <input 
                                        value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                                        className="bg-transparent border-none outline-none text-xs w-80 font-mono text-slate-700"
                                        placeholder="API URL..."
                                    />
                                </div>
                                <textarea 
                                    value={wordsInput} onChange={e => setWordsInput(e.target.value)}
                                    className="bg-transparent border-none outline-none text-sm flex-1 px-4 py-1 h-10 resize-none font-bold text-slate-800 leading-tight"
                                    placeholder="输入单词，以逗号分隔..."
                                />
                            </div>
                            <button 
                                onClick={fetchTemplateData} disabled={isFetching}
                                className="bg-blue-600 text-white px-6 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-2"
                            >
                                {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} 获取结构
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex gap-6 p-6 overflow-hidden">
                {/* 左侧：树与规则 */}
                <div className="w-[45%] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-600" />
                            <h3 className="font-black text-slate-800 text-sm">规则配置</h3>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-white rounded-lg disabled:opacity-30" title="撤销"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white rounded-lg disabled:opacity-30" title="重做"><RotateCw className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-200 mx-1 self-center"></div>
                            <button onClick={clearAllSelections} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition" title="清空选择"><Eraser className="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-white">
                        {jsonData ? renderNode('ROOT', jsonData, 'root', 0) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm">
                                <AlertCircle className="w-10 h-10 opacity-10 mb-2" />
                                <p>请先点击上方“获取结构”</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                         <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase">
                            <div>LISTS: <span className="text-purple-600 text-lg ml-1">{lists.length}</span></div>
                            <div>MAPS: <span className="text-blue-600 text-lg ml-1">{mappings.length}</span></div>
                         </div>
                         <button 
                            onClick={generateAll}
                            disabled={!jsonData || isGenerating || (mappings.length === 0 && lists.length === 0)}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-all shadow-xl disabled:opacity-30 flex items-center gap-3"
                         >
                             {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} 执行全量生成
                         </button>
                    </div>
                </div>

                {/* 右侧：生成预览 */}
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button onClick={() => setPreviewMode('cards')} className={`p-1.5 rounded-md transition ${previewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setPreviewMode('json')} className={`p-1.5 rounded-md transition ${previewMode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><FileJson className="w-4 h-4" /></button>
                            </div>
                            <h3 className="font-black text-slate-800 text-sm">生成预览</h3>
                        </div>
                        {previewResult && previewResult.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 mr-2">选中 {selectedPreviewIds.size} 项:</span>
                                <button onClick={() => handleImportToStorage(WordCategory.WantToLearnWord)} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 text-[10px] font-bold hover:bg-amber-100 flex items-center gap-1"><Plus className="w-3 h-3"/>想学习</button>
                                <button onClick={() => handleImportToStorage(WordCategory.LearningWord)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-[10px] font-bold hover:bg-blue-100 flex items-center gap-1"><BookOpen className="w-3 h-3"/>正在学</button>
                                <button onClick={() => handleImportToStorage(WordCategory.KnownWord)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[10px] font-bold hover:bg-emerald-100 flex items-center gap-1"><GraduationCap className="w-3 h-3"/>已掌握</button>
                            </div>
                        )}
                    </div>

                    <div className={`flex-1 overflow-auto custom-scrollbar ${previewMode === 'json' ? 'bg-slate-950 p-6' : 'bg-slate-50 p-6'}`}>
                        {previewResult ? (
                            previewMode === 'json' ? (
                                <pre className="text-emerald-400 text-xs font-mono">{JSON.stringify(previewResult, null, 2)}</pre>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center mb-2 px-2">
                                        <button 
                                            onClick={() => setSelectedPreviewIds(selectedPreviewIds.size === previewResult.length ? new Set() : new Set(previewResult.map((_, i) => i)))}
                                            className="text-[10px] font-bold text-slate-500 flex items-center gap-2 hover:text-slate-800"
                                        >
                                            {selectedPreviewIds.size === previewResult.length ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>}
                                            全选 / 取消全选
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {previewResult.map((item, idx) => (
                                            <div key={idx} className={`bg-white p-4 rounded-xl border transition-all flex gap-4 ${selectedPreviewIds.has(idx) ? 'border-blue-500 shadow-md ring-1 ring-blue-100' : 'border-slate-200'}`}>
                                                <div className="pt-1">
                                                    <button onClick={() => {const next = new Set(selectedPreviewIds); if(next.has(idx)) next.delete(idx); else next.add(idx); setSelectedPreviewIds(next);}}>
                                                        {selectedPreviewIds.has(idx) ? <CheckSquare className="w-5 h-5 text-blue-600"/> : <Square className="w-5 h-5 text-slate-300"/>}
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <h4 className="text-xl font-black text-slate-900 leading-none">{item.text}</h4>
                                                            <p className="text-xs text-slate-400 font-mono mt-1.5">{item.phoneticUs || item.phoneticUk}</p>
                                                        </div>
                                                        <div className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-[10px] font-bold border border-amber-100">{item.translation}</div>
                                                    </div>
                                                    <div className="space-y-1.5 mt-3">
                                                        {item.contextSentence && <div className="text-[11px] text-slate-600 italic border-l-2 border-blue-400 pl-3 leading-relaxed">{item.contextSentence}</div>}
                                                        {item.englishDefinition && <div className="text-[10px] text-slate-400 leading-snug">{item.englishDefinition}</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <Code className="w-16 h-16 opacity-5 mb-4" />
                                <p className="font-bold opacity-30 uppercase tracking-widest text-xs">Waiting for generation...</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
