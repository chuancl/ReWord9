
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { 
    Play, Download, Trash2, ChevronRight, ChevronDown, List, MapPin, 
    Database, Send, AlertCircle, Code, Save, RotateCcw, RotateCw, 
    Eraser, LayoutGrid, FileJson, CheckSquare, Square, Plus, 
    CheckCircle, BookOpen, GraduationCap, Loader2, FileUp, Eye,
    UploadCloud, DownloadCloud, Scale, Image as ImageIcon, Video,
    Quote, Globe, Star, Info, GripVertical, FileDown
} from 'lucide-react';
import { Logo } from './Logo';
import { Toast, ToastMessage } from './ui/Toast';
import { WordCategory, WordEntry } from '../types';
import { entriesStorage } from '../utils/storage';
import { storage } from 'wxt/storage';

// 映射可用字段
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
    { id: 'videoUrl', label: '视频-播放地址 (video.url)' },
    { id: 'videoTitle', label: '视频-标题 (video.title)' },
    { id: 'videoCover', label: '视频-封面 (video.cover)' }
];

interface MappingConfig {
    path: string;
    field: string;
    weight: number; 
    isBase?: boolean;
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
const MAX_DEPTH = 40;

export const BatchDataGenerator: React.FC = () => {
    const [apiUrl, setApiUrl] = useState('https://dict.youdao.com/jsonapi?q={word}');
    const [importedWords, setImportedWords] = useState<string[]>([]);
    const [jsonData, setJsonData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // UI 布局状态
    const [leftPanelWidth, setLeftPanelWidth] = useState(40); // 百分比
    const isResizing = useRef(false);

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

    // 拖拽调整大小逻辑
    const startResizing = useCallback((e: React.MouseEvent) => {
        isResizing.current = true;
        document.addEventListener('mousemove', handleResizing);
        document.addEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const handleResizing = useCallback((e: MouseEvent) => {
        if (!isResizing.current) return;
        const newWidth = (e.clientX / window.innerWidth) * 100;
        if (newWidth > 20 && newWidth < 80) {
            setLeftPanelWidth(newWidth);
        }
    }, []);

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.removeEventListener('mousemove', handleResizing);
        document.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, []);

    const loadRulesForApi = async (url: string) => {
        const allRules = await storage.getItem<Record<string, RuleSet>>(RULES_STORAGE_KEY) || {};
        const rule = allRules[url];
        if (rule) {
            setMappings(rule.mappings || []);
            setLists(rule.lists || []);
            saveHistory(rule.mappings || [], rule.lists || [], false);
        } else {
            setMappings([]); setLists([]); saveHistory([], [], false);
        }
    };

    useEffect(() => { if (apiUrl) loadRulesForApi(apiUrl); }, [apiUrl]);

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
        if (!shouldPush) { setHistory([{ mappings: [...m], lists: [...l] }]); setHistoryIndex(0); return; }
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push({ mappings: [...m], lists: [...l] });
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory); setHistoryIndex(newHistory.length - 1);
    };

    const undo = () => { if (historyIndex > 0) { const p = history[historyIndex - 1]; setMappings(p.mappings); setLists(p.lists); setHistoryIndex(historyIndex - 1); } };
    const redo = () => { if (historyIndex < history.length - 1) { const n = history[historyIndex + 1]; setMappings(n.mappings); setLists(n.lists); setHistoryIndex(historyIndex + 1); } };
    const clearAll = () => { setMappings([]); setLists([]); saveHistory([], []); showToast('配置已清空', 'info'); };

    const normalizePath = (path: string) => path.replace(/\.\d+/g, '');

    const fetchTemplateData = async (word: string) => {
        if (!word) return;
        setIsFetching(true);
        try {
            const res = await fetch(apiUrl.replace('{word}', encodeURIComponent(word)));
            const data = await res.json();
            setJsonData(data);
            showToast(`已获取 "${word}" 的数据结构`, 'success');
        } catch (e: any) { showToast(`获取失败: ${e.message}`, 'error'); } 
        finally { setIsFetching(false); }
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const words = text.split(/[\n,，\r]/).map(w => w.trim()).filter(Boolean);
            if (words.length > 0) { setImportedWords(words); fetchTemplateData(words[0]); }
        };
        reader.readAsText(file);
    };

    const handleExportRules = () => {
        const config = { apiUrl, mappings, lists };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reword_rules_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('配置导出成功', 'success');
    };

    const handleExportPreviewData = () => {
        if (!previewResult) return;
        const blob = new Blob([JSON.stringify(previewResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reword_batch_data_${new Date().getTime()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('批导数据 JSON 导出成功', 'success');
    };

    const handleImportRules = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);
                if (config.apiUrl) setApiUrl(config.apiUrl);
                if (Array.isArray(config.mappings)) setMappings(config.mappings);
                if (Array.isArray(config.lists)) setLists(config.lists);
                saveHistory(config.mappings || [], config.lists || []);
                showToast('配置导入成功', 'success');
            } catch (err) { showToast('配置导入失败：格式错误', 'error'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    const isListPath = (path: string) => lists.some(l => l.path === normalizePath(path));
    const getMapping = (path: string) => mappings.find(m => m.path === normalizePath(path));

    const toggleList = (path: string) => {
        const nPath = normalizePath(path);
        let newLists = lists.some(l => l.path === nPath) ? lists.filter(l => l.path !== nPath) : [...lists, { path: nPath }];
        setLists(newLists); saveHistory(mappings, newLists);
    };

    const setMapping = (path: string, field: string) => {
        const nPath = normalizePath(path);
        let newMappings = field ? (mappings.find(m => m.path === nPath) ? mappings.map(m => m.path === nPath ? { ...m, field } : m) : [...mappings, { path: nPath, field, weight: 1, isBase: false }]) : mappings.filter(m => m.path !== nPath);
        setMappings(newMappings); saveHistory(newMappings, lists);
    };

    const toggleBaseInfo = (path: string) => {
        const nPath = normalizePath(path);
        const newMappings = mappings.map(m => m.path === nPath ? { ...m, isBase: !m.isBase } : m);
        setMappings(newMappings); saveHistory(newMappings, lists);
    };

    const setWeight = (path: string, weight: number) => {
        const nPath = normalizePath(path);
        const newMappings = mappings.map(m => m.path === nPath ? { ...m, weight } : m);
        setMappings(newMappings); saveHistory(newMappings, lists);
    };

    const renderNode = (key: string, value: any, path: string, depth: number) => {
        const isObject = value !== null && typeof value === 'object';
        const isExpanded = expandedPaths.has(path);
        const mapping = getMapping(path);
        const isList = isListPath(path);

        return (
            <div key={path} className="select-none">
                <div className={`flex items-center gap-2 py-1.5 px-3 rounded-xl transition-all group mb-1 border
                        ${isList ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-100' : 
                          mapping?.isBase ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-100' : 
                          mapping ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}>
                    {isObject ? (
                        <button onClick={() => {const n = new Set(expandedPaths); isExpanded ? n.delete(path) : n.add(path); setExpandedPaths(n);}} className="p-1 hover:bg-white rounded-md shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6 shrink-0" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold shrink-0 ${isList ? 'text-purple-700' : mapping?.isBase ? 'text-amber-700' : mapping ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        {!isObject && <span className="text-sm text-slate-400 truncate font-mono italic" title={String(value)}>: {typeof value === 'string' ? `"${value}"` : String(value)}</span>}
                    </div>

                    <div className={`flex items-center gap-1.5 shrink-0 ${isList || mapping ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button onClick={() => toggleList(path)} className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase border flex items-center gap-1 ${isList ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 hover:border-purple-400'}`}>
                            <List className="w-3 h-3" /> {isList ? 'LIST' : 'SET LIST'}
                        </button>
                        <select value={mapping?.field || ''} onChange={(e) => setMapping(path, e.target.value)} className={`text-[10px] font-bold h-8 rounded-lg border outline-none px-2 ${mapping ? (mapping.isBase ? 'bg-amber-600 text-white' : 'bg-blue-600 text-white') : 'bg-white text-slate-400'}`}>
                            <option value="">MAP FIELD...</option>
                            {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                        {mapping && (
                            <>
                                <button onClick={() => toggleBaseInfo(path)} className={`h-8 px-2 rounded-lg border flex items-center gap-1 text-[10px] font-bold transition-all ${mapping.isBase ? 'bg-amber-100 border-amber-400 text-amber-700 shadow-inner' : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300'}`} title="标记为基本信息">
                                    <Info className="w-3.5 h-3.5" /> BASE
                                </button>
                                <select value={mapping.weight} onChange={(e) => setWeight(path, parseInt(e.target.value))} className="text-[10px] font-black text-blue-600 bg-white border border-slate-200 rounded-lg h-8 px-1">
                                    {[1,2,3,4,5,6,7,8,9].map(w => <option key={w} value={w}>W{w}</option>)}
                                </select>
                            </>
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

    const runGeneration = async (isFull: boolean) => {
        const words = isFull ? importedWords : importedWords.slice(0, 1);
        if (words.length === 0) { showToast('请先导入单词列表', 'warning'); return; }

        setIsGenerating(true);
        const allFinalResults: any[] = [];
        const mappingConfigs = mappings;
        const listPaths = new Set(lists.map(l => l.path));

        const sanitizeValue = (val: any) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') return val;
            if (typeof val === 'number') return val;
            if (typeof val === 'object') {
                // 深度提取文本：如果是数组，取第一个；如果是对象，取常见的文本键
                if (Array.isArray(val)) return sanitizeValue(val[0]);
                const textKeys = ['text', 'value', 'word', 'name', 'chn_tran', 'tran', 'definition', 'i'];
                for (const k of textKeys) {
                    if (val[k]) return sanitizeValue(val[k]);
                }
                return JSON.stringify(val);
            }
            return String(val);
        };

        try {
            for (const word of words) {
                const res = await fetch(apiUrl.replace('{word}', encodeURIComponent(word)));
                const data = await res.json();
                const wordFinalEntries: any[] = [];

                const globalBaseCandidates = new Map<string, Array<{value: any, weight: number}>>();
                const collectBase = (n: any, p: string, d: number) => {
                    if (d > MAX_DEPTH) return;
                    const np = normalizePath(p);
                    mappingConfigs.filter(m => m.path === np && m.isBase).forEach(m => {
                        const vals = globalBaseCandidates.get(m.field) || [];
                        globalBaseCandidates.set(m.field, [...vals, { value: n, weight: m.weight }]);
                    });
                    if (typeof n === 'object' && n !== null) Object.entries(n).forEach(([k, v]) => collectBase(v, `${p}.${k}`, d + 1));
                };
                collectBase(data, 'root', 0);

                const finalize = (branchCandidates: Map<string, any[]>) => {
                    const entry: any = { text: word };
                    const allCands = new Map(branchCandidates);
                    globalBaseCandidates.forEach((vals, field) => {
                        const existing = allCands.get(field) || [];
                        allCands.set(field, [...existing, ...vals]);
                    });

                    allCands.forEach((vals, field) => {
                        const sorted = vals.sort((a, b) => a.weight - b.weight);
                        for (const item of sorted) {
                            if (item.value !== undefined && item.value !== null && item.value !== '') {
                                entry[field] = sanitizeValue(item.value); 
                                break;
                            }
                        }
                    });

                    if (entry.videoUrl) {
                        entry.video = { url: entry.videoUrl, title: entry.videoTitle || '讲解视频', cover: entry.videoCover || '' };
                        delete entry.videoUrl; delete entry.videoTitle; delete entry.videoCover;
                    }
                    ['inflections', 'tags', 'phrases', 'roots', 'synonyms'].forEach(f => {
                        if (entry[f] && typeof entry[f] === 'string') entry[f] = entry[f].split(/[,，;；]/).map((s: string) => s.trim()).filter(Boolean);
                        else if (entry[f] && !Array.isArray(entry[f])) entry[f] = [entry[f]];
                    });

                    if (Object.keys(entry).length > 1) wordFinalEntries.push(entry);
                };

                const traverse = (node: any, path: string, inheritedCtx: Map<string, any[]>, depth: number) => {
                    if (depth > MAX_DEPTH) return;
                    const nPath = normalizePath(path);
                    const currentCtx = new Map();
                    inheritedCtx.forEach((v, k) => currentCtx.set(k, [...v]));
                    mappingConfigs.filter(m => m.path === nPath && !m.isBase).forEach(m => {
                        const vals = currentCtx.get(m.field) || [];
                        currentCtx.set(m.field, [...vals, { value: node, weight: m.weight }]);
                    });

                    if (listPaths.has(nPath) && node) {
                        const items = Array.isArray(node) ? node : [node];
                        items.forEach((item, idx) => {
                            const subPath = Array.isArray(node) ? `${path}.${idx}` : path;
                            const hasSubList = Array.from(listPaths).some(lp => lp.startsWith(nPath + '.') && lp !== nPath);
                            if (hasSubList && typeof item === 'object' && item !== null) Object.keys(item).forEach(k => traverse(item[k], `${subPath}.${k}`, currentCtx, depth + 1));
                            else {
                                const leafCtx = new Map();
                                currentCtx.forEach((v, k) => leafCtx.set(k, [...v]));
                                const collectLeafValues = (ln: any, lp: string, ld: number) => {
                                    if (ld > MAX_DEPTH) return;
                                    const lnp = normalizePath(lp);
                                    mappingConfigs.filter(m => m.path === lnp && !m.isBase).forEach(m => {
                                        const lvs = leafCtx.get(m.field) || [];
                                        leafCtx.set(m.field, [...lvs, { value: ln, weight: m.weight }]);
                                    });
                                    if (typeof ln === 'object' && ln !== null) Object.entries(ln).forEach(([lk, lv]) => collectLeafValues(lv, `${lp}.${lk}`, ld + 1));
                                };
                                collectLeafValues(item, subPath, depth + 1);
                                finalize(leafCtx);
                            }
                        });
                    } else if (typeof node === 'object' && node !== null) Object.keys(node).forEach(k => traverse(node[k], `${path}.${k}`, currentCtx, depth + 1));
                };

                traverse(data, 'root', new Map(), 0);
                if (wordFinalEntries.length === 0 && mappings.length > 0) {
                    const rootOnlyCtx = new Map();
                    const collectSimple = (sn: any, sp: string, sd: number) => {
                        const snp = normalizePath(sp);
                        mappingConfigs.filter(m => m.path === snp && !m.isBase).forEach(m => {
                            const svs = rootOnlyCtx.get(m.field) || [];
                            rootOnlyCtx.set(m.field, [...svs, { value: sn, weight: m.weight }]);
                        });
                        if (typeof sn === 'object' && sn !== null && sd < MAX_DEPTH) Object.entries(sn).forEach(([sk, sv]) => collectSimple(sv, `${sp}.${sk}`, sd + 1));
                    };
                    collectSimple(data, 'root', 0);
                    finalize(rootOnlyCtx);
                }
                allFinalResults.push(...wordFinalEntries);
            }
            setPreviewResult(allFinalResults);
            setSelectedPreviewIds(new Set(allFinalResults.map((_, i) => i)));
            showToast(isFull ? `全量生成完成：产出 ${allFinalResults.length} 个条目` : '预览生成成功', 'success');
        } catch (e: any) { showToast(`解析失败: ${e.message}`, 'error'); } 
        finally { setIsGenerating(false); }
    };

    const handleImportToStorage = async (category: WordCategory) => {
        const selected = previewResult?.filter((_, idx) => selectedPreviewIds.has(idx)) || [];
        const current = await entriesStorage.getValue();
        const newOnes = selected.map(item => ({
            ...item, id: `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category, addedAt: Date.now(), scenarioId: '1'
        }));
        await entriesStorage.setValue([...current, ...newOnes]);
        showToast(`成功导入 ${newOnes.length} 个单词至 "${category}"`, 'success');
        setPreviewResult(previewResult?.filter((_, idx) => !selectedPreviewIds.has(idx)) || null);
    };

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
            <header className="bg-white border-b border-slate-200 px-8 h-20 flex items-center justify-between shrink-0 shadow-sm z-[100]">
                <Logo />
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <div className="flex items-center px-4 py-2 gap-3">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input value={apiUrl} onChange={e => setApiUrl(e.target.value)} className="bg-transparent border-none outline-none text-xs w-[32rem] font-mono text-slate-700" placeholder="输入 API 地址..."/>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExportRules} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="导出配置"><DownloadCloud className="w-5 h-5"/></button>
                        <button onClick={() => ruleImportRef.current?.click()} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500" title="导入配置"><UploadCloud className="w-5 h-5"/></button>
                        <input type="file" ref={ruleImportRef} className="hidden" accept=".json" onChange={handleImportRules} />
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>
                    <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-600 text-white px-6 h-11 rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2">
                        <FileUp className="w-4 h-4" /> 导入单词 TXT
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileImport} />
                </div>
            </header>

            <main className="flex-1 flex p-6 overflow-hidden relative">
                {/* 左侧：路径解析 */}
                <div className="flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden" style={{ width: `${leftPanelWidth}%` }}>
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2"><Database className="w-4 h-4 text-blue-600"/> 解析规则与分枝配置</h3>
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={historyIndex <= 0} className="p-2 disabled:opacity-30"><RotateCcw className="w-4 h-4" /></button>
                            <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 disabled:opacity-30"><RotateCw className="w-4 h-4" /></button>
                            <button onClick={clearAll} className="p-2 hover:text-red-500"><Eraser className="w-4 h-4" /></button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-white">
                        {jsonData ? renderNode('ROOT', jsonData, 'root', 0) : <div className="h-full flex flex-col items-center justify-center text-slate-300 italic text-sm p-12 text-center"><Database className="w-12 h-12 mb-4 opacity-5"/><p>导入单词后开始配置。支持笛卡尔积解析。</p></div>}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                         <div className="flex gap-4 text-[10px] font-black text-slate-400 uppercase">
                            <div>LISTS: <span className="text-purple-600 text-lg">{lists.length}</span></div>
                            <div>MAPS: <span className="text-blue-600 text-lg">{mappings.length}</span></div>
                         </div>
                         <div className="flex gap-3">
                            <button onClick={() => runGeneration(false)} disabled={!jsonData || isGenerating} className="bg-white text-slate-700 border border-slate-200 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-slate-50 transition active:scale-95"><Eye className="w-4 h-4" /> 义项预览</button>
                            <button onClick={() => runGeneration(true)} disabled={!jsonData || isGenerating} className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-3 hover:bg-black shadow-xl transition active:scale-95">{isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5 fill-current" />} 批量生成</button>
                         </div>
                    </div>
                </div>

                {/* 分割条 */}
                <div 
                    className="w-1.5 hover:w-2 mx-1 flex items-center justify-center cursor-col-resize group transition-all"
                    onMouseDown={startResizing}
                >
                    <div className="h-10 w-1 bg-slate-300 rounded-full group-hover:bg-blue-400"></div>
                </div>

                {/* 右侧：生成预览结果 */}
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-4">
                            <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                <button onClick={() => setPreviewMode('cards')} className={`p-1.5 rounded-md ${previewMode === 'cards' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
                                <button onClick={() => setPreviewMode('json')} className={`p-1.5 rounded-md ${previewMode === 'json' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}><FileJson className="w-4 h-4" /></button>
                            </div>
                            <h3 className="font-black text-slate-800 text-sm">解析数据预览 ({previewResult?.length || 0})</h3>
                        </div>
                        {previewResult && previewResult.length > 0 && (
                            <div className="flex items-center gap-2">
                                {previewMode === 'json' ? (
                                    <button 
                                        onClick={handleExportPreviewData} 
                                        className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200 active:scale-95 transition"
                                    >
                                        <FileDown className="w-4 h-4"/> 导出批导 JSON 数据
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => handleImportToStorage(WordCategory.WantToLearnWord)} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100 transition"><Plus className="w-3 h-3"/>想学</button>
                                        <button onClick={() => handleImportToStorage(WordCategory.LearningWord)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 text-[10px] font-bold flex items-center gap-1 hover:bg-blue-100 transition"><BookOpen className="w-3 h-3"/>在学</button>
                                        <button onClick={() => handleImportToStorage(WordCategory.KnownWord)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[10px] font-bold flex items-center gap-1 hover:bg-emerald-100 transition"><GraduationCap className="w-3 h-3"/>掌握</button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`flex-1 overflow-auto custom-scrollbar p-6 ${previewMode === 'json' ? 'bg-slate-900' : 'bg-slate-50'}`}>
                        {previewResult ? (
                            previewMode === 'json' ? <pre className="text-emerald-400 text-xs font-mono">{JSON.stringify(previewResult, null, 2)}</pre> : (
                                <div className="space-y-4">
                                    <div className="flex items-center text-[10px] font-bold text-slate-400 gap-4 mb-2">
                                        <button onClick={() => setSelectedPreviewIds(selectedPreviewIds.size === previewResult.length ? new Set() : new Set(previewResult.map((_, i) => i)))} className="flex items-center gap-1 hover:text-slate-700">{selectedPreviewIds.size === previewResult.length ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>} 全选/取消</button>
                                    </div>
                                    {previewResult.map((item, idx) => (
                                        <div key={idx} className={`bg-white p-5 rounded-2xl border transition-all flex gap-4 ${selectedPreviewIds.has(idx) ? 'border-blue-500 ring-1 ring-blue-100 shadow-md' : 'border-slate-200 hover:border-slate-300'}`}>
                                            <button onClick={() => {const n = new Set(selectedPreviewIds); if(n.has(idx)) n.delete(idx); else n.add(idx); setSelectedPreviewIds(n);}}>
                                                {selectedPreviewIds.has(idx) ? <CheckSquare className="w-5 h-5 text-blue-600"/> : <Square className="w-5 h-5 text-slate-300"/>}
                                            </button>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <div className="flex items-center gap-3">
                                                        <h4 className="text-xl font-black text-slate-900 leading-none">{item.text}</h4>
                                                        <span className="text-xs text-slate-400 font-mono">{item.phoneticUs || item.phoneticUk}</span>
                                                    </div>
                                                    <div className="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold border border-amber-100 truncate max-w-[400px]">{item.translation}</div>
                                                </div>
                                                <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mb-3">
                                                    {item.importance && <div className="flex text-amber-400">{'★'.repeat(item.importance)} <span className="ml-1 text-slate-300">(柯林斯星级)</span></div>}
                                                    {item.partOfSpeech && <span className="italic text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 leading-none">{item.partOfSpeech}</span>}
                                                    {item.cocaRank && <span>COCA #{item.cocaRank}</span>}
                                                </div>
                                                <div className="space-y-2">
                                                    {(item.dictionaryExample || item.contextSentence) && (
                                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                            <p className="text-sm text-slate-700 leading-relaxed italic">{item.dictionaryExample || item.contextSentence}</p>
                                                            <p className="text-xs text-slate-400 mt-1">{item.dictionaryExampleTranslation || item.contextSentenceTranslation}</p>
                                                        </div>
                                                    )}
                                                    {item.mixedSentence && (
                                                        <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                                                            <span className="text-[10px] text-purple-400 font-black uppercase block mb-1">混合预览</span>
                                                            <p className="text-sm text-purple-900">{item.mixedSentence}</p>
                                                        </div>
                                                    )}
                                                    <div className="flex flex-wrap gap-2 pt-1">
                                                        {item.image && <div className="flex items-center gap-1 text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded-md border border-blue-100"><ImageIcon className="w-3 h-3"/> 已关联图片</div>}
                                                        {item.video && <div className="flex items-center gap-1 text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100"><Video className="w-3 h-3"/> 已关联视频</div>}
                                                        {item.sourceUrl && <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200"><Globe className="w-3 h-3"/> 来源/维基</div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 font-bold opacity-30 uppercase tracking-widest text-xs"><Code className="w-16 h-16 mb-4 opacity-5"/> Waiting for Data...</div>}
                    </div>
                </div>
            </main>
            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
