
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

// 映射可用字段 - 最终增强版
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
    // 视频分项映射，生成时自动合并为 WordEntry 要求的 video 对象结构
    { id: 'videoUrl', label: '视频-播放地址 (video.url)' },
    { id: 'videoTitle', label: '视频-标题 (video.title)' },
    { id: 'videoCover', label: '视频-封面 (video.cover)' }
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

    const loadRulesForApi = async (url: string) => {
        const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
        const rule = allRules[url];
        if (rule) {
            setMappings(rule.mappings || []);
            setLists(rule.lists || []);
            saveHistory(rule.mappings || [], rule.lists || [], false);
            showToast(`已载入 API 历史配置`, 'info');
        } else {
            setMappings([]);
            setLists([]);
            saveHistory([], [], false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (apiUrl) loadRulesForApi(apiUrl);
        }, 500);
        return () => clearTimeout(timer);
    }, [apiUrl]);

    useEffect(() => {
        if (!apiUrl || historyIndex === -1) return;
        const timer = setTimeout(async () => {
            const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
            allRules[apiUrl] = {
                apiUrl,
                mappings,
                lists,
                updatedAt: Date.now()
            };
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
        showToast('配置已清空', 'info');
    };

    const normalizePath = (path: string) => path.replace(/\.\d+/g, '');

    const fetchTemplateData = async (word: string) => {
        if (!word) return;
        setIsFetching(true);
        try {
            const url = apiUrl.replace('{word}', encodeURIComponent(word));
            const response = await fetch(url);
            const data = await response.json();
            setJsonData(data);
            showToast(`已获取并解析数据结构`, 'success');
        } catch (e: any) {
            showToast(`请求失败: ${e.message}`, 'error');
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reword_rules_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('规则库已导出', 'success');
    };

    const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const imported = JSON.parse(event.target?.result as string);
                const current = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
                const merged = { ...current, ...imported };
                await storage.setItem(RULES_STORAGE_KEY, merged);
                showToast(`成功导入 ${Object.keys(imported).length} 套 API 映射规则`, 'success');
                loadRulesForApi(apiUrl);
            } catch (err) {
                showToast('导入失败', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const toggleExpand = (path: string) => {
        const next = new Set(expandedPaths);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        setExpandedPaths(next);
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
        let newMappings;
        if (!field) {
            newMappings = mappings.filter(m => m.path !== nPath);
        } else {
            const existing = mappings.find(m => m.path === nPath);
            if (existing) {
                newMappings = mappings.map(m => m.path === nPath ? { ...m, field } : m);
            } else {
                newMappings = [...mappings, { path: nPath, field, weight: 1 }];
            }
        }
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
                <div 
                    className={`flex items-center gap-2 py-1 px-3 rounded-xl transition-all group mb-1 border
                        ${isList ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-100' : 
                          mapping ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    {isObject ? (
                        <button onClick={() => toggleExpand(path)} className="p-1 hover:bg-white rounded-md shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6 shrink-0" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold shrink-0 ${isList ? 'text-purple-700' : mapping ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        {!isObject && (
                            <span className="text-sm text-slate-400 truncate font-mono italic" title={String(value)}>: {typeof value === 'string' ? `"${value}"` : String(value)}</span>
                        )}
                    </div>

                    <div className={`flex items-center gap-2 shrink-0 ${isList || mapping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button onClick={() => toggleList(path)} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border ${isList ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 hover:border-purple-400'}`}>
                            <List className="w-3 h-3" /> {isList ? 'LIST' : 'SET LIST'}
                        </button>
                        
                        <div className="flex items-center gap-1">
                            <select value={mapping?.field || ''} onChange={(e) => setMapping(path, e.target.value)} className={`text-[10px] font-bold h-7 rounded-lg border outline-none px-2 ${mapping ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-400'}`}>
                                <option value="">MAP FIELD...</option>
                                {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                            </select>
                            
                            {mapping && (
                                <div className="flex items-center gap-1 bg-white border border-blue-200 rounded-lg h-7 px-1.5 ml-1" title="映射优先级 (1最高)">
                                    <Scale className="w-3 h-3 text-blue-400" />
                                    <select 
                                        value={mapping.weight} 
                                        onChange={(e) => setWeight(path, parseInt(e.target.value))}
                                        className="text-[10px] font-black text-blue-600 bg-transparent outline-none"
                                    >
                                        {[1,2,3,4,5,6,7,8,9].map(w => <option key={w} value={w}>W{w}</option>)}
                                    </select>
                                </div>
                            )}
                        </div>
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
     * 执行全量或单词预览生成
     */
    const runGeneration = async (isFull: boolean) => {
        const words = isFull ? importedWords : importedWords.slice(0, 1);
        if (words.length === 0) {
            showToast('请先导入 TXT 单词列表', 'warning');
            return;
        }

        setIsGenerating(true);
        const allResults: any[] = [];
        const mappingConfigs = mappings;
        const listSet = new Set(lists.map(l => l.path));

        try {
            for (const word of words) {
                const url = apiUrl.replace('{word}', encodeURIComponent(word));
                const res = await fetch(url);
                const data = await res.json();
                const resultsForThisWord: any[] = [];

                const resolveEntry = (candidates: Map<string, Array<{value: any, weight: number}>>) => {
                    const finalEntry: any = { text: word };
                    candidates.forEach((vals, field) => {
                        const sorted = vals.sort((a, b) => a.weight - b.weight);
                        for (const item of sorted) {
                            if (item.value !== undefined && item.value !== null && item.value !== '') {
                                finalEntry[field] = item.value;
                                break;
                            }
                        }
                    });
                    
                    // 1. 数组型字段归一化处理
                    ['inflections', 'tags'].forEach(field => {
                        if (finalEntry[field] && typeof finalEntry[field] === 'string') {
                            finalEntry[field] = finalEntry[field].split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean);
                        } else if (finalEntry[field] && !Array.isArray(finalEntry[field])) {
                            finalEntry[field] = [String(finalEntry[field])];
                        }
                    });

                    // 2. 辅学字段始终保持数组结构
                    ['phrases', 'roots', 'synonyms'].forEach(field => {
                        if (finalEntry[field] && !Array.isArray(finalEntry[field])) {
                            finalEntry[field] = [finalEntry[field]];
                        }
                    });

                    // 3. 视频对象重构 (videoUrl, videoTitle, videoCover -> video object)
                    if (finalEntry.videoUrl) {
                        finalEntry.video = {
                            url: finalEntry.videoUrl,
                            title: finalEntry.videoTitle || '单词讲解视频',
                            cover: finalEntry.videoCover || ''
                        };
                        delete finalEntry.videoUrl;
                        delete finalEntry.videoTitle;
                        delete finalEntry.videoCover;
                    }

                    if (Object.keys(finalEntry).length > 1) {
                        resultsForThisWord.push(finalEntry);
                    }
                };

                const walk = (d: any, currentPath: string, parentCandidates: Map<string, Array<{value: any, weight: number}>>) => {
                    const nPath = normalizePath(currentPath);
                    const isListMarker = listSet.has(nPath);
                    
                    const matches = mappingConfigs.filter(m => m.path === nPath);
                    matches.forEach(m => {
                        const existing = parentCandidates.get(m.field) || [];
                        parentCandidates.set(m.field, [...existing, { value: d, weight: m.weight }]);
                    });

                    if (isListMarker && d) {
                        const items = Array.isArray(d) ? d : [d];
                        items.forEach((item, idx) => {
                            const subPath = Array.isArray(d) ? `${currentPath}.${idx}` : currentPath;
                            const branchCandidates = new Map();
                            parentCandidates.forEach((v, k) => branchCandidates.set(k, [...v]));
                            processBranch(item, subPath, branchCandidates);
                        });
                    } else if (typeof d === 'object' && d !== null) {
                        Object.keys(d).forEach(k => {
                            const childPath = `${currentPath}.${k}`;
                            walk(d[k], childPath, parentCandidates);
                        });
                    }
                };

                const processBranch = (d: any, currentPath: string, branchCandidates: Map<string, Array<{value: any, weight: number}>>) => {
                    const nPath = normalizePath(currentPath);
                    const matches = mappingConfigs.filter(m => m.path === nPath);
                    matches.forEach(m => {
                        const existing = branchCandidates.get(m.field) || [];
                        branchCandidates.set(m.field, [...existing, { value: d, weight: m.weight }]);
                    });

                    if (typeof d === 'object' && d !== null) {
                        let hasDeepList = Object.keys(d).some(k => listSet.has(normalizePath(`${currentPath}.${k}`)));
                        if (hasDeepList) {
                            walk(d, currentPath, branchCandidates);
                        } else {
                            const collectDeep = (innerD: any, innerP: string) => {
                                if (typeof innerD === 'object' && innerD !== null) {
                                    Object.entries(innerD).forEach(([k, v]) => {
                                        const sp = `${innerP}.${k}`;
                                        const mms = mappingConfigs.filter(m => m.path === normalizePath(sp));
                                        mms.forEach(m => {
                                            const existing = branchCandidates.get(m.field) || [];
                                            branchCandidates.set(m.field, [...existing, { value: v, weight: m.weight }]);
                                        });
                                        collectDeep(v, sp);
                                    });
                                }
                            };
                            collectDeep(d, currentPath);
                            resolveEntry(branchCandidates);
                        }
                    } else {
                        resolveEntry(branchCandidates);
                    }
                };

                walk(data, 'root', new Map());
                if (resultsForThisWord.length === 0 && mappings.length > 0) {
                   const finalCandidates = new Map();
                   const collectAll = (d: any, p: string) => {
                        const mms = mappingConfigs.filter(m => m.path === normalizePath(p));
                        mms.forEach(m => {
                            const existing = finalCandidates.get(m.field) || [];
                            finalCandidates.set(m.field, [...existing, { value: d, weight: m.weight }]);
                        });
                        if (typeof d === 'object' && d !== null) {
                            Object.entries(d).forEach(([k, v]) => collectAll(v, `${p}.${k}`));
                        }
                   };
                   collectAll(data, 'root');
                   resolveEntry(finalCandidates);
                }
                
                allResults.push(...resultsForThisWord);
            }
            setPreviewResult(allResults);
            setSelectedPreviewIds(new Set(allResults.map((_, i) => i)));
            showToast(isFull ? `全量处理完成: 共匹配 ${allResults.length} 条数据` : '单词预览解析成功', 'success');
        } catch (e: any) {
            showToast(`生成失败: ${e.message}`, 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleImportToStorage = async (category: WordCategory) => {
        if (!previewResult || selectedPreviewIds.size === 0) return;
        const selectedEntries = previewResult.filter((_, idx) => selectedPreviewIds.has(idx));
        const currentEntries = await entriesStorage.getValue();
        const newEntries: WordEntry[] = selectedEntries.map(item => ({
            ...item,
            id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category, addedAt: Date.now(), scenarioId: '1',
            inflections: item.inflections || [], tags: item.tags || []
        }));
        await entriesStorage.setValue([...currentEntries, ...newEntries]);
        showToast(`已成功导入 ${newEntries.length} 个单词至 "${category}"`, 'success');
        setPreviewResult(previewResult.filter((_, idx) => !selectedPreviewIds.has(idx)));
        setSelectedPreviewIds(new Set());
    };

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
            <header className="bg-white border-b border-slate-200 px-8 h-20 flex items-center justify-between shrink-0 shadow-sm z-50">
                <Logo />
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <div className="flex items-center px-4 py-2 gap-3">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input 
                                value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                                className="bg-transparent border-none outline-none text-xs w-96 font-mono text-slate-700"
                                placeholder="输入 API 地址 (例如有道 API)..."
                            />
                        </div>
                    </div>
                    
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>

                    <div className="flex items-center gap-2">
                        <button onClick={handleExportRules} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="导出规则库"><DownloadCloud className="w-5 h-5"/></button>
                        <button onClick={() => ruleImportRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition" title="导入规则文件"><UploadCloud className="w-5 h-5"/></button>
                        <input type="file" ref={ruleImportRef} className="hidden" accept=".json" onChange={handleImportRules} />
                    </div>

                    <div className="h-8 w-px bg-slate-200 mx-2"></div>

                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileImport} />
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isFetching}
                        className="bg-indigo-600 text-white px-6 h-11 rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md flex items-center gap-2 active:scale-95"
                    >
                        {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} 导入 TXT 单词库
                    </button>
                </div>
            </header>

            <main className="flex-1 flex gap-6 p-6 overflow-hidden">
                {/* 左侧：规则映射配置 */}
                <div className="w-[48%] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-600" />
                            <h3 className="font-black text-slate-800 text-sm">解析映射配置</h3>
                            <span className="text-[10px] text-slate-400 font-bold bg-white px-2 py-0.5 rounded border border-slate-200 ml-2">自动保存</span>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 hover:bg-white rounded-lg disabled:opacity-30"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 hover:bg-white rounded-lg disabled:opacity-30"><RotateCw className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-200 mx-1 self-center"></div>
                            <button onClick={clearAllSelections} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition"><Eraser className="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-white">
                        {jsonData ? renderNode('ROOT', jsonData, 'root', 0) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm p-12 text-center">
                                <FileUp className="w-12 h-12 opacity-10 mb-4" />
                                <p>导入 TXT 单词列表后显示 API 数据结构。<br/>所有规则映射将按 API 地址自动持久化保存。</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                         <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase">
                            <div>LISTS: <span className="text-purple-600 text-lg ml-1">{lists.length}</span></div>
                            <div>MAPS: <span className="text-blue-600 text-lg ml-1">{mappings.length}</span></div>
                         </div>
                         <div className="flex gap-3">
                            <button 
                                onClick={() => runGeneration(false)}
                                disabled={!jsonData || isGenerating || (mappings.length === 0)}
                                className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold hover:bg-slate-50 transition-all disabled:opacity-30 flex items-center gap-2 active:scale-95"
                            >
                                <Eye className="w-4 h-4" /> 单词预览
                            </button>
                            <button 
                                onClick={() => runGeneration(true)}
                                disabled={!jsonData || isGenerating || (mappings.length === 0)}
                                className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-all shadow-xl disabled:opacity-30 flex items-center gap-3 active:scale-95"
                            >
                                {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} 全量批量生成
                            </button>
                         </div>
                    </div>
                </div>

                {/* 右侧：生成预览结果 */}
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button onClick={() => setPreviewMode('cards')} className={`p-1.5 rounded-md transition ${previewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setPreviewMode('json')} className={`p-1.5 rounded-md transition ${previewMode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><FileJson className="w-4 h-4" /></button>
                            </div>
                            <h3 className="font-black text-slate-800 text-sm">解析数据预览</h3>
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
                                            全选 / 取消
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4">
                                        {previewResult.map((item, idx) => (
                                            <div key={idx} className={`bg-white p-5 rounded-2xl border transition-all flex gap-4 ${selectedPreviewIds.has(idx) ? 'border-blue-500 shadow-md ring-1 ring-blue-100' : 'border-slate-200'}`}>
                                                <div className="pt-1">
                                                    <button onClick={() => {const next = new Set(selectedPreviewIds); if(next.has(idx)) next.delete(idx); else next.add(idx); setSelectedPreviewIds(next);}}>
                                                        {selectedPreviewIds.has(idx) ? <CheckSquare className="w-5 h-5 text-blue-600"/> : <Square className="w-5 h-5 text-slate-300"/>}
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="text-2xl font-black text-slate-900 leading-none">{item.text}</h4>
                                                            <span className="text-xs text-slate-400 font-mono pt-1">{item.phoneticUs || item.phoneticUk}</span>
                                                        </div>
                                                        <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-100 truncate max-w-[200px]" title={item.translation}>{item.translation}</div>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-3">
                                                         {item.importance && <div className="flex text-amber-400">{'★'.repeat(item.importance)} <span className="ml-1 text-slate-300">(柯林斯星级)</span></div>}
                                                         {item.cocaRank && <span>COCA #{item.cocaRank}</span>}
                                                         {item.partOfSpeech && <span className="italic text-slate-300">{item.partOfSpeech}</span>}
                                                    </div>

                                                    <div className="space-y-3">
                                                        {item.mixedSentence && (
                                                            <div className="bg-purple-50 p-2.5 rounded-xl border border-purple-100">
                                                                <span className="text-[9px] font-black text-purple-400 uppercase block mb-1">中英混合例句</span>
                                                                <p className="text-xs text-purple-900 leading-relaxed">{item.mixedSentence}</p>
                                                            </div>
                                                        )}
                                                        {(item.dictionaryExample || item.contextSentence) && (
                                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                                <p className="text-sm text-slate-700 font-medium leading-relaxed">{item.dictionaryExample || item.contextSentence}</p>
                                                                <p className="text-xs text-slate-400 mt-1">{item.dictionaryExampleTranslation || item.contextSentenceTranslation}</p>
                                                            </div>
                                                        )}
                                                        
                                                        <div className="flex gap-2">
                                                            {item.image && <div className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded-md border border-blue-100"><ImageIcon className="w-3 h-3"/> 已关联图片</div>}
                                                            {item.video && <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100"><Video className="w-3 h-3"/> 已关联讲解视频</div>}
                                                            {item.sourceUrl && <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200"><Globe className="w-3 h-3"/> 来源/维基已关联</div>}
                                                        </div>
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
                                <p className="font-bold opacity-30 uppercase tracking-widest text-xs">Waiting for data...</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
