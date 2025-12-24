
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
    Play, Download, Trash2, ChevronRight, ChevronDown, List, MapPin, 
    Database, Send, AlertCircle, Code, Save, RotateCcw, RotateCw, 
    Eraser, LayoutGrid, FileJson, CheckSquare, Square, Plus, 
    CheckCircle, BookOpen, GraduationCap, Loader2, FileUp, Eye,
    UploadCloud, DownloadCloud, Scale, Image as ImageIcon, Video,
    Quote, Globe
} from 'lucide-react';
import { Logo } from './Logo';
import { Toast, ToastMessage } from './ui/Toast';
import { WordCategory, WordEntry } from '../types';
import { entriesStorage } from '../utils/storage';
import { storage } from 'wxt/storage';

// 映射可用字段 - 增强补全版
const MAPPING_FIELDS = [
    { id: 'text', label: '单词拼写 (text)' },
    { id: 'translation', label: '中文释义 (translation)' },
    { id: 'phoneticUs', label: '美式音标 (phoneticUs)' },
    { id: 'phoneticUk', label: '英式音标 (phoneticUk)' },
    { id: 'partOfSpeech', label: '词性 (partOfSpeech)' },
    { id: 'englishDefinition', label: '英文定义 (englishDefinition)' },
    { id: 'inflections', label: '词态变化 (inflections)', type: 'array' },
    { id: 'dictionaryExample', label: '词典例句 (dictionaryExample)' },
    { id: 'dictionaryExampleTranslation', label: '词典例句翻译 (dictionaryExampleTranslation)' },
    { id: 'contextSentence', label: '来源原句 (contextSentence)' },
    { id: 'contextSentenceTranslation', label: '来源原句翻译 (contextSentenceTranslation)' },
    { id: 'mixedSentence', label: '中英混合例句 (mixedSentence)' },
    { id: 'phrases', label: '常用短语 (phrases)', type: 'array' },
    { id: 'roots', label: '词根词缀 (roots)', type: 'array' },
    { id: 'synonyms', label: '近义词 (synonyms)', type: 'array' },
    { id: 'tags', label: '标签 (tags)', type: 'array' },
    { id: 'importance', label: '柯林斯星级 (importance)', type: 'number' },
    { id: 'cocaRank', label: 'COCA排名 (cocaRank)', type: 'number' },
    { id: 'image', label: '图片 URL (image)' },
    { id: 'sourceUrl', label: '来源/维基地址 (sourceUrl)' },
    // 视频分项映射
    { id: 'videoUrl', label: '讲解视频-播放地址 (video.url)' },
    { id: 'videoTitle', label: '讲解视频-标题 (video.title)' },
    { id: 'videoCover', label: '讲解视频-封面 (video.cover)' }
];

interface MappingConfig {
    path: string;
    field: string;
    weight: number; 
}

interface ListConfig {
    path: string;
}

interface RuleSet {
    apiUrl: string;
    mappings: MappingConfig[];
    lists: ListConfig[];
    updatedAt: number;
}

interface HistoryStep {
    mappings: MappingConfig[];
    lists: ListConfig[];
}

const RULES_STORAGE_KEY = 'local:batch-generator-rules';
const MAX_DEPTH = 30; // 递归深度保护

export const BatchDataGenerator: React.FC = () => {
    const [apiUrl, setApiUrl] = useState('https://dict.youdao.com/jsonapi?q={word}');
    const [importedWords, setImportedWords] = useState<string[]>([]);
    const [jsonData, setJsonData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const ruleImportRef = useRef<HTMLInputElement>(null);

    const [mappings, setMappings] = useState<MappingConfig[]>([]);
    const [lists, setLists] = useState<ListConfig[]>([]);
    
    const [history, setHistory] = useState<HistoryStep[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const [previewMode, setPreviewMode] = useState<'json' | 'cards'>('cards');
    const [previewResult, setPreviewResult] = useState<any[] | null>(null);
    const [selectedPreviewIds, setSelectedPreviewIds] = useState<Set<number>>(new Set());
    
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']));
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const showToast = (message: string, type: ToastMessage['type'] = 'success') => setToast({ id: Date.now(), message, type });

    // 加载规则
    const loadRulesForApi = async (url: string) => {
        const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
        const rule = allRules[url];
        if (rule) {
            setMappings(rule.mappings || []);
            setLists(rule.lists || []);
            saveHistory(rule.mappings || [], rule.lists || [], false);
        } else {
            setMappings([]);
            setLists([]);
            saveHistory([], [], false);
        }
    };

    useEffect(() => {
        if (apiUrl) {
            const timer = setTimeout(() => loadRulesForApi(apiUrl), 300);
            return () => clearTimeout(timer);
        }
    }, [apiUrl]);

    // 自动保存规则
    useEffect(() => {
        if (!apiUrl || historyIndex === -1) return;
        const timer = setTimeout(async () => {
            const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
            allRules[apiUrl] = { apiUrl, mappings, lists, updatedAt: Date.now() };
            await storage.setItem(RULES_STORAGE_KEY, allRules);
        }, 1000);
        return () => clearTimeout(timer);
    }, [mappings, lists, apiUrl]);

    const saveHistory = (m: MappingConfig[], l: ListConfig[], shouldPush = true) => {
        if (!shouldPush) {
            setHistory([{ mappings: [...m], lists: [...l] }]);
            setHistoryIndex(0);
            return;
        }
        const newStep = { mappings: [...m], lists: [...l] };
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newStep);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => { if (historyIndex > 0) { const prev = history[historyIndex - 1]; setMappings(prev.mappings); setLists(prev.lists); setHistoryIndex(historyIndex - 1); } };
    const redo = () => { if (historyIndex < history.length - 1) { const next = history[historyIndex + 1]; setMappings(next.mappings); setLists(next.lists); setHistoryIndex(historyIndex + 1); } };
    const clearAllSelections = () => { setMappings([]); setLists([]); saveHistory([], []); showToast('规则已清空', 'info'); };

    const normalizePath = (path: string) => path.replace(/\.\d+/g, '');

    const fetchTemplateData = async (word: string) => {
        if (!word) return;
        setIsFetching(true);
        try {
            const url = apiUrl.replace('{word}', encodeURIComponent(word));
            const response = await fetch(url);
            const data = await response.json();
            setJsonData(data);
            showToast(`获取 "${word}" 数据结构成功`, 'success');
        } catch (e: any) {
            showToast(`获取失败: ${e.message}`, 'error');
        } finally {
            setIsFetching(false);
        }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const words = text.split(/[\n,，\r]/).map(w => w.trim()).filter(Boolean);
            if (words.length > 0) {
                setImportedWords(words);
                fetchTemplateData(words[0]); 
            }
        };
        reader.readAsText(file);
        e.target.value = ''; 
    };

    const handleExportRules = async () => {
        const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
        const blob = new Blob([JSON.stringify(allRules, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reword_batch_rules.json`;
        a.click();
    };

    const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                const current = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
                await storage.setItem(RULES_STORAGE_KEY, { ...current, ...imported });
                showToast(`导入映射规则成功`, 'success');
                loadRulesForApi(apiUrl);
            } catch (err) { showToast('导入失败', 'error'); }
        };
        reader.readAsText(file);
    };

    const isListPath = (path: string) => lists.some(l => l.path === normalizePath(path));
    const getMapping = (path: string) => mappings.find(m => m.path === normalizePath(path));

    const toggleList = (path: string) => {
        const nPath = normalizePath(path);
        let newLists = lists.some(l => l.path === nPath) ? lists.filter(l => l.path !== nPath) : [...lists, { path: nPath }];
        setLists(newLists);
        saveHistory(mappings, newLists);
    };

    const setMapping = (path: string, field: string) => {
        const nPath = normalizePath(path);
        let newMappings = field ? (mappings.find(m => m.path === nPath) ? mappings.map(m => m.path === nPath ? { ...m, field } : m) : [...mappings, { path: nPath, field, weight: 1 }]) : mappings.filter(m => m.path !== nPath);
        setMappings(newMappings);
        saveHistory(newMappings, lists);
    };

    const setWeight = (path: string, weight: number) => {
        const nPath = normalizePath(path);
        const newMappings = mappings.map(m => m.path === nPath ? { ...m, weight } : m);
        setMappings(newMappings);
        saveHistory(newMappings, lists);
    };

    const renderNode = (key: string, value: any, path: string, depth: number) => {
        const isObject = value !== null && typeof value === 'object';
        const isExpanded = expandedPaths.has(path);
        const mapping = getMapping(path);
        const isList = isListPath(path);

        return (
            <div key={path} className="select-none">
                <div className={`flex items-center gap-2 py-1 px-3 rounded-xl transition-all group mb-1 border
                        ${isList ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-100' : mapping ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}>
                    {isObject ? (
                        <button onClick={() => {const next = new Set(expandedPaths); if(next.has(path)) next.delete(path); else next.add(path); setExpandedPaths(next);}} className="p-1 hover:bg-white rounded-md shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6 shrink-0" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold shrink-0 ${isList ? 'text-purple-700' : mapping ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        {!isObject && <span className="text-sm text-slate-400 truncate font-mono italic" title={String(value)}>: {typeof value === 'string' ? `"${value}"` : String(value)}</span>}
                    </div>

                    <div className={`flex items-center gap-2 shrink-0 ${isList || mapping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button onClick={() => toggleList(path)} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${isList ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 hover:border-purple-400'}`}>
                            <List className="w-3 h-3" /> {isList ? 'LIST' : 'SET LIST'}
                        </button>
                        <select value={mapping?.field || ''} onChange={(e) => setMapping(path, e.target.value)} className={`text-[10px] font-bold h-7 rounded-lg border outline-none px-2 ${mapping ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                            <option value="">MAP FIELD...</option>
                            {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        {mapping && (
                            <select value={mapping.weight} onChange={(e) => setWeight(path, parseInt(e.target.value))} className="text-[10px] font-black text-blue-600 bg-white border border-blue-200 rounded-lg h-7 px-1.5 outline-none ml-1">
                                {[1,2,3,4,5,6,7,8,9].map(w => <option key={w} value={w}>W{w}</option>)}
                            </select>
                        )}
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
     * 解析引擎：支持嵌套列表逻辑
     */
    const runGeneration = async (isFull: boolean) => {
        const words = isFull ? importedWords : importedWords.slice(0, 1);
        if (words.length === 0) { showToast('请先导入单词列表', 'warning'); return; }

        setIsGenerating(true);
        const allFinalResults: any[] = [];
        const mappingConfigs = mappings;
        const listPaths = new Set(lists.map(l => l.path));

        try {
            for (const word of words) {
                const url = apiUrl.replace('{word}', encodeURIComponent(word));
                const res = await fetch(url);
                const data = await res.json();
                const wordEntries: any[] = [];

                // 解析核心逻辑：生成词条对象
                const finalize = (candidates: Map<string, Array<{value: any, weight: number}>>) => {
                    const entry: any = { text: word };
                    candidates.forEach((vals, field) => {
                        // 权重排序，取最小权重的值
                        const sorted = vals.sort((a, b) => a.weight - b.weight);
                        for (const item of sorted) {
                            if (item.value !== undefined && item.value !== null && item.value !== '') {
                                entry[field] = item.value;
                                break;
                            }
                        }
                    });

                    // 数据后处理：对象化视频，格式化数组
                    if (entry.videoUrl) {
                        entry.video = { url: entry.videoUrl, title: entry.videoTitle || '讲解视频', cover: entry.videoCover || '' };
                        delete entry.videoUrl; delete entry.videoTitle; delete entry.videoCover;
                    }
                    ['inflections', 'tags', 'phrases', 'roots', 'synonyms'].forEach(f => {
                        if (entry[f] && typeof entry[f] === 'string') {
                            entry[f] = entry[f].split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean);
                        } else if (entry[f] && !Array.isArray(entry[f])) {
                            entry[f] = [entry[f]];
                        }
                    });

                    if (Object.keys(entry).length > 1) wordEntries.push(entry);
                };

                /**
                 * 递归遍历器：能够识别嵌套的 LIST 标记
                 * @param node 当前 JSON 节点
                 * @param path 当前路径
                 * @param context 继承自父级的候选字段池
                 * @param depth 深度计数
                 */
                const traverse = (node: any, path: string, context: Map<string, any[]>, depth: number) => {
                    if (depth > MAX_DEPTH) return;
                    const nPath = normalizePath(path);
                    
                    // 1. 收集当前路径的所有普通映射
                    const currentMatches = mappingConfigs.filter(m => m.path === nPath);
                    currentMatches.forEach(m => {
                        const vals = context.get(m.field) || [];
                        context.set(m.field, [...vals, { value: node, weight: m.weight }]);
                    });

                    // 2. 判断是否是 LIST 循环点
                    if (listPaths.has(nPath) && node) {
                        const items = Array.isArray(node) ? node : [node];
                        items.forEach((item, idx) => {
                            // 为每一个列表项创建独立的克隆 Context（继承父级字段）
                            const nextContext = new Map();
                            context.forEach((v, k) => nextContext.set(k, [...v]));
                            
                            const subPath = Array.isArray(node) ? `${path}.${idx}` : path;
                            
                            // 检查子节点中是否还有其它的 LIST
                            let hasNestedList = false;
                            if (typeof item === 'object' && item !== null) {
                                // 查找当前路径下的配置是否有更深层的 LIST
                                const deeperLists = Array.from(listPaths).filter(lp => lp.startsWith(nPath + '.') && lp !== nPath);
                                if (deeperLists.length > 0) hasNestedList = true;
                            }

                            if (hasNestedList) {
                                // 如果有嵌套循环，继续递归
                                Object.keys(item).forEach(k => traverse(item[k], `${subPath}.${k}`, nextContext, depth + 1));
                            } else {
                                // 如果这是最深层的循环点，收集该节点下的所有非 LIST 映射，然后产出词条
                                const collectLeaves = (n: any, p: string, d: number) => {
                                    if (d > MAX_DEPTH) return;
                                    const np = normalizePath(p);
                                    mappingConfigs.filter(m => m.path === np).forEach(m => {
                                        const vs = nextContext.get(m.field) || [];
                                        nextContext.set(m.field, [...vs, { value: n, weight: m.weight }]);
                                    });
                                    if (typeof n === 'object' && n !== null) {
                                        Object.entries(n).forEach(([k, v]) => collectLeaves(v, `${p}.${k}`, d + 1));
                                    }
                                };
                                collectLeaves(item, subPath, depth + 1);
                                finalize(nextContext);
                            }
                        });
                    } else if (typeof node === 'object' && node !== null) {
                        // 普通对象，继续向下寻找 LIST
                        Object.keys(node).forEach(k => traverse(node[k], `${path}.${k}`, context, depth + 1));
                    }
                };

                // 执行解析
                traverse(data, 'root', new Map(), 0);

                // 兜底：如果没有配置 LIST 映射但配置了字段映射，生成单条数据
                if (wordEntries.length === 0 && mappings.length > 0) {
                    const rootCtx = new Map();
                    const simpleCollect = (n: any, p: string, d: number) => {
                        const np = normalizePath(p);
                        mappingConfigs.filter(m => m.path === np).forEach(m => {
                            const vs = rootCtx.get(m.field) || [];
                            rootCtx.set(m.field, [...vs, { value: n, weight: m.weight }]);
                        });
                        if (typeof n === 'object' && n !== null && d < MAX_DEPTH) {
                            Object.entries(n).forEach(([k, v]) => simpleCollect(v, `${p}.${k}`, d + 1));
                        }
                    };
                    simpleCollect(data, 'root', 0);
                    finalize(rootCtx);
                }

                allFinalResults.push(...wordEntries);
            }
            setPreviewResult(allFinalResults);
            setSelectedPreviewIds(new Set(allFinalResults.map((_, i) => i)));
            showToast(isFull ? `完成: 解析到 ${allFinalResults.length} 条数据` : '预览解析成功', 'success');
        } catch (e: any) {
            showToast(`生成失败: ${e.message}`, 'error');
        } finally { setIsGenerating(false); }
    };

    const handleImportToStorage = async (category: WordCategory) => {
        if (!previewResult) return;
        const selected = previewResult.filter((_, idx) => selectedPreviewIds.has(idx));
        const current = await entriesStorage.getValue();
        const newOnes = selected.map(item => ({
            ...item, id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category, addedAt: Date.now(), scenarioId: '1'
        }));
        await entriesStorage.setValue([...current, ...newOnes]);
        showToast(`成功导入 ${newOnes.length} 个单词至 "${category}"`, 'success');
        setPreviewResult(previewResult.filter((_, idx) => !selectedPreviewIds.has(idx)));
    };

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
            <header className="bg-white border-b border-slate-200 px-8 h-20 flex items-center justify-between shrink-0 shadow-sm z-50">
                <Logo />
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <div className="flex items-center px-4 py-2 gap-3">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="bg-transparent border-none outline-none text-xs w-96 font-mono text-slate-700" placeholder="API 地址..."/>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportRules} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="导出规则"><DownloadCloud className="w-5 h-5"/></button>
                        <button onClick={() => ruleImportRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="导入规则"><UploadCloud className="w-5 h-5"/></button>
                        <input type="file" ref={ruleImportRef} className="hidden" accept=".json" onChange={handleImportRules} />
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-6 h-11 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2">
                        <FileUp className="w-4 h-4" /> 导入单词库 (.txt)
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileImport} />
                </div>
            </header>

            <main className="flex-1 flex gap-6 p-6 overflow-hidden">
                <div className="w-[45%] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2"><Database className="w-4 h-4 text-blue-600"/> 解析规则配置</h3>
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 disabled:opacity-30"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 disabled:opacity-30"><RotateCw className="w-4 h-4" /></button>
                            <button onClick={clearAllSelections} className="p-2 hover:text-red-500"><Eraser className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-white">
                        {jsonData ? renderNode('ROOT', jsonData, 'root', 0) : <div className="h-full flex items-center justify-center text-slate-300 italic text-sm">导入单词后开始配置。规则将按 API 地址自动持久化。</div>}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                         <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase">
                            <div>LISTS: <span className="text-purple-600 text-lg">{lists.length}</span></div>
                            <div>MAPS: <span className="text-blue-600 text-lg">{mappings.length}</span></div>
                         </div>
                         <div className="flex gap-3">
                            <button onClick={() => runGeneration(false)} disabled={!jsonData || isGenerating} className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50"><Eye className="w-4 h-4" /> 预览</button>
                            <button onClick={() => runGeneration(true)} disabled={!jsonData || isGenerating} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-3 hover:bg-black shadow-xl active:scale-95">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} 批量全量生成</button>
                         </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button onClick={() => setPreviewMode('cards')} className={`p-1.5 rounded-md ${previewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setPreviewMode('json')} className={`p-1.5 rounded-md ${previewMode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><FileJson className="w-4 h-4" /></button>
                            </div>
                            <h3 className="font-black text-slate-800 text-sm">生成预览</h3>
                        </div>
                        {previewResult && previewResult.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleImportToStorage(WordCategory.WantToLearnWord)} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100"><Plus className="w-3 h-3"/>想学</button>
                                <button onClick={() => handleImportToStorage(WordCategory.LearningWord)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-[10px] font-bold flex items-center gap-1 hover:bg-blue-100"><BookOpen className="w-3 h-3"/>在学</button>
                                <button onClick={() => handleImportToStorage(WordCategory.KnownWord)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100"><GraduationCap className="w-3 h-3"/>掌握</button>
                            </div>
                        )}
                    </div>
                    <div className={`flex-1 overflow-auto custom-scrollbar p-6 ${previewMode === 'json' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        {previewResult ? (
                            previewMode === 'json' ? <pre className="text-emerald-400 text-xs font-mono">{JSON.stringify(previewResult, null, 2)}</pre> : (
                                <div className="space-y-4">
                                    <div className="flex items-center text-[10px] font-bold text-slate-400 gap-4 mb-2">
                                        <button onClick={() => setSelectedPreviewIds(selectedPreviewIds.size === previewResult.length ? new Set() : new Set(previewResult.map((_, i) => i)))} className="flex items-center gap-1 hover:text-slate-700">{selectedPreviewIds.size === previewResult.length ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>} 全选/取消</button>
                                        <span>共匹配到 {previewResult.length} 条数据</span>
                                    </div>
                                    {previewResult.map((item, idx) => (
                                        <div key={idx} className={`bg-white p-5 rounded-2xl border transition-all flex gap-4 ${selectedPreviewIds.has(idx) ? 'border-blue-500 ring-1 ring-blue-100 shadow-md' : 'border-slate-200'}`}>
                                            <button onClick={() => {const n = new Set(selectedPreviewIds); if(n.has(idx)) n.delete(idx); else n.add(idx); setSelectedPreviewIds(n);}}>
                                                {selectedPreviewIds.has(idx) ? <CheckSquare className="w-5 h-5 text-blue-600"/> : <Square className="w-5 h-5 text-slate-300"/>}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-xl font-black text-slate-900 leading-none">{item.text}</h4>
                                                        <span className="text-xs text-slate-400 font-mono">{item.phoneticUs || item.phoneticUk}</span>
                                                    </div>
                                                    <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-100 truncate max-w-[200px]">{item.translation}</div>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-3">
                                                    {item.importance && <div className="flex text-amber-400">{'★'.repeat(item.importance)} <span className="ml-1 text-slate-300">(柯林斯星级)</span></div>}
                                                    {item.partOfSpeech && <span className="italic">{item.partOfSpeech}</span>}
                                                </div>
                                                <div className="space-y-2">
                                                    {(item.dictionaryExample || item.contextSentence) && (
                                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                            <p className="text-sm text-slate-700 leading-relaxed italic">{item.dictionaryExample || item.contextSentence}</p>
                                                            <p className="text-xs text-slate-400 mt-1">{item.dictionaryExampleTranslation || item.contextSentenceTranslation}</p>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.image && <div className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded-md border border-blue-100"><ImageIcon className="w-3 h-3"/> 已关联图片</div>}
                                                        {item.video && <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100"><Video className="w-3 h-3"/> 已关联视频</div>}
                                                        {item.sourceUrl && <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200"><Globe className="w-3 h-3"/> 来源关联</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 font-bold opacity-30 uppercase tracking-widest text-xs"><Code className="w-16 h-16 mb-4 opacity-5"/> Waiting...</div>}
                    </div>
                </div>
            </main>
            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
