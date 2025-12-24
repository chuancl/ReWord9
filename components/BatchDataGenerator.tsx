
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Play, Download, Trash2, ChevronRight, ChevronDown, List, MapPin, Database, Send, AlertCircle, HelpCircle, Code, Copy, Check, Info } from 'lucide-react';
import { Logo } from './Logo';
import { Toast, ToastMessage } from './ui/Toast';

// 导入映射可用字段
const MAPPING_FIELDS = [
    { id: 'text', label: '单词拼写 (text)' },
    { id: 'translation', label: '中文释义 (translation)' },
    { id: 'phoneticUs', label: '美式音标 (phoneticUs)' },
    { id: 'phoneticUk', label: '英式音标 (phoneticUk)' },
    { id: 'partOfSpeech', label: '词性 (partOfSpeech)' },
    { id: 'englishDefinition', label: '英文定义 (englishDefinition)' },
    { id: 'contextSentence', label: '例句 (contextSentence)' },
    { id: 'contextSentenceTranslation', label: '例句翻译 (contextSentenceTranslation)' },
    { id: 'tags', label: '标签 (tags) - 需数组或字符串', type: 'array' },
    { id: 'importance', label: '重要程度 (importance) - 数字', type: 'number' },
    { id: 'cocaRank', label: 'COCA排名 (cocaRank) - 数字', type: 'number' }
];

interface MappingConfig {
    path: string; // 存储的是归一化路径，如 root.ec.word.usphone
    field: string;
}

interface ListConfig {
    path: string; // 归一化路径，如 root.ec.word
}

export const BatchDataGenerator: React.FC = () => {
    const [apiUrl, setApiUrl] = useState('https://dict.youdao.com/jsonapi?q={word}');
    const [testWord, setTestWord] = useState('book');
    const [jsonData, setJsonData] = useState<any>(null);
    const [isFetching, setIsFetching] = useState(false);
    
    // 配置状态
    const [mappings, setMappings] = useState<MappingConfig[]>([]);
    const [lists, setLists] = useState<ListConfig[]>([]);
    
    // UI 展开状态
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['root']));
    
    // 预览结果
    const [previewResult, setPreviewResult] = useState<any[] | null>(null);
    
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const showToast = (message: string, type: ToastMessage['type'] = 'success') => setToast({ id: Date.now(), message, type });

    // 路径归一化：将实例路径 root.ec.word.0.usphone 转换为模板路径 root.ec.word.usphone
    const normalizePath = (path: string) => {
        return path.replace(/\.\d+/g, '');
    };

    const fetchData = async () => {
        if (!apiUrl.includes('{word}')) {
            showToast('URL 必须包含 {word} 占位符', 'error');
            return;
        }
        setIsFetching(true);
        setJsonData(null);
        setPreviewResult(null);
        try {
            const url = apiUrl.replace('{word}', encodeURIComponent(testWord));
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            const data = await response.json();
            setJsonData(data);
            showToast('数据请求成功', 'success');
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

    const isListPath = (path: string) => {
        const nPath = normalizePath(path);
        return lists.some(l => l.path === nPath);
    };

    const getMappingField = (path: string) => {
        const nPath = normalizePath(path);
        return mappings.find(m => m.path === nPath)?.field;
    };

    const toggleList = (path: string) => {
        const nPath = normalizePath(path);
        if (lists.some(l => l.path === nPath)) {
            setLists(lists.filter(l => l.path !== nPath));
        } else {
            setLists([...lists, { path: nPath }]);
        }
    };

    const setMapping = (path: string, field: string) => {
        const nPath = normalizePath(path);
        if (!field) {
            setMappings(mappings.filter(m => m.path !== nPath));
            return;
        }
        const existing = mappings.find(m => m.path === nPath);
        if (existing) {
            setMappings(mappings.map(m => m.path === nPath ? { ...m, field } : m));
        } else {
            setMappings([...mappings, { path: nPath, field }]);
        }
    };

    // 渲染 JSON 树节点
    const renderNode = (key: string, value: any, path: string, depth: number) => {
        const isObject = value !== null && typeof value === 'object';
        const isExpanded = expandedPaths.has(path);
        const mappedField = getMappingField(path);
        const isList = isListPath(path);

        return (
            <div key={path} className="select-none">
                <div 
                    className={`flex items-center gap-2 py-1 px-3 rounded-xl transition-all group mb-1 border
                        ${isList ? 'bg-purple-50 border-purple-300 ring-1 ring-purple-100 shadow-sm' : 
                          mappedField ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-100 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    {isObject ? (
                        <button onClick={() => toggleExpand(path)} className="p-1 hover:bg-white rounded-md transition-colors shrink-0">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6 shrink-0" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold shrink-0 ${isList ? 'text-purple-700' : mappedField ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        <span className="text-slate-300 shrink-0">:</span>
                        
                        {!isObject && (
                            <span className="text-sm text-slate-400 truncate font-mono italic" title={String(value)}>
                                {typeof value === 'string' ? `"${value}"` : String(value)}
                            </span>
                        )}

                        {isObject && (
                            <span className="text-[9px] font-black text-slate-300 bg-slate-100/50 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
                            </span>
                        )}
                    </div>

                    {/* 操作区：标记后通过 opacity-100 保持可见 */}
                    <div className={`flex items-center gap-2 transition-all shrink-0 ${isList || mappedField ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                            onClick={() => toggleList(path)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border
                                ${isList ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-purple-400 hover:text-purple-600'}`}
                        >
                            <List className="w-3 h-3" />
                            {isList ? 'List Item' : 'Set List'}
                        </button>

                        <select 
                            value={mappedField || ''}
                            onChange={(e) => setMapping(path, e.target.value)}
                            className={`text-[10px] font-bold h-7 rounded-lg border outline-none transition-all px-2 shadow-sm
                                ${mappedField ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400'}`}
                        >
                            <option value="">Map Field...</option>
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
     * 生成逻辑优化
     */
    const generateEntries = () => {
        if (!jsonData) return;

        const results: any[] = [];
        const mappingMap = new Map(mappings.map(m => [m.path, m.field]));
        const listSet = new Set(lists.map(l => l.path));

        const walk = (data: any, currentPath: string, context: any) => {
            const nPath = normalizePath(currentPath);
            const isListMarker = listSet.has(nPath);
            const mappedField = mappingMap.get(nPath);

            let currentContext = { ...context };
            if (mappedField) currentContext[mappedField] = data;

            if (isListMarker && data) {
                const items = Array.isArray(data) ? data : [data];
                items.forEach((item, idx) => {
                    const subPath = Array.isArray(data) ? `${currentPath}.${idx}` : currentPath;
                    processBranch(item, subPath, { ...currentContext });
                });
            } else if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                // 收集同级静态字段
                keys.forEach(k => {
                    const childPath = `${currentPath}.${k}`;
                    const childNPath = normalizePath(childPath);
                    const childField = mappingMap.get(childNPath);
                    if (childField && !listSet.has(childNPath) && typeof data[k] !== 'object') {
                        currentContext[childField] = data[k];
                    }
                });
                // 递归子级
                keys.forEach(k => {
                    const childPath = `${currentPath}.${k}`;
                    if (listSet.has(normalizePath(childPath)) || typeof data[k] === 'object') {
                        walk(data[k], childPath, currentContext);
                    }
                });
            }
        };

        const processBranch = (data: any, currentPath: string, branchContext: any) => {
            const nPath = normalizePath(currentPath);
            const mappedField = mappingMap.get(nPath);
            if (mappedField) branchContext[mappedField] = data;

            if (typeof data === 'object' && data !== null) {
                const keys = Object.keys(data);
                let hasDeepList = false;
                
                keys.forEach(k => {
                    const cp = `${currentPath}.${k}`;
                    const cnp = normalizePath(cp);
                    const f = mappingMap.get(cnp);
                    if (f && !listSet.has(cnp)) branchContext[f] = data[k];
                    if (listSet.has(cnp)) hasDeepList = true;
                });

                if (hasDeepList) {
                    walk(data, currentPath, branchContext);
                } else {
                    const collect = (d: any, p: string) => {
                        if (typeof d === 'object' && d !== null) {
                            Object.entries(d).forEach(([k, v]) => {
                                const sp = `${p}.${k}`;
                                const f = mappingMap.get(normalizePath(sp));
                                if (f) branchContext[f] = v;
                                collect(v, sp);
                            });
                        }
                    };
                    collect(data, currentPath);
                    pushResult(branchContext);
                }
            } else {
                pushResult(branchContext);
            }
        };

        const pushResult = (entry: any) => {
            if (!entry.text && testWord) entry.text = testWord;
            if (Object.keys(entry).length > 1 || (entry.text && Object.keys(entry).length > 0)) {
                results.push(entry);
            }
        };

        walk(jsonData, 'root', {});

        if (results.length === 0) {
            showToast('生成失败：请确保至少标记了一个列表项和一些字段。', 'error');
        } else {
            setPreviewResult(results);
            showToast(`生成成功，共计 ${results.length} 条数据`, 'success');
        }
    };

    const handleExport = () => {
        if (!previewResult) return;
        const blob = new Blob([JSON.stringify(previewResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reword_batch_${testWord}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 bg-slate-50 flex flex-col overflow-hidden font-sans">
            <header className="bg-white border-b border-slate-200 px-8 h-20 flex items-center justify-between shrink-0 shadow-sm z-50">
                <Logo />
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <div className="flex items-center px-4 py-2 gap-3 border-r border-slate-200">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input 
                                value={apiUrl} 
                                onChange={e => setApiUrl(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-96 font-mono font-medium text-slate-700"
                                placeholder="API URL..."
                            />
                        </div>
                        <div className="flex items-center px-4 py-2 gap-3">
                            <Code className="w-4 h-4 text-purple-500" />
                            <input 
                                value={testWord} 
                                onChange={e => setTestWord(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-24 font-black text-slate-800"
                                placeholder="Word"
                            />
                        </div>
                        <button 
                            onClick={fetchData} 
                            disabled={isFetching}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md active:scale-95 flex items-center gap-2"
                        >
                            {isFetching ? <Send className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            解析数据
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex gap-8 p-8 overflow-hidden h-[calc(100vh-80px)]">
                {/* JSON Tree Column */}
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800">数据结构</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Select List & Map Fields</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-6 custom-scrollbar scroll-smooth min-h-0 bg-white">
                        {jsonData ? (
                            <div className="space-y-0.5">
                                {renderNode('ROOT', jsonData, 'root', 0)}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <AlertCircle className="w-12 h-12 opacity-10 mb-4" />
                                <p className="font-bold">等待数据输入...</p>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-between items-center">
                         <div className="flex gap-8">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase">循环层级</span>
                                <span className="text-xl font-black text-purple-600 leading-none mt-1">{lists.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase">已映射</span>
                                <span className="text-xl font-black text-blue-600 leading-none mt-1">{mappings.length}</span>
                            </div>
                         </div>
                         <button 
                            onClick={generateEntries}
                            disabled={!jsonData || (mappings.length === 0 && lists.length === 0)}
                            className="bg-slate-900 text-white px-8 py-3.5 rounded-2xl font-black hover:bg-black transition-all shadow-xl disabled:opacity-30 active:scale-95 flex items-center gap-3"
                         >
                             <Play className="w-5 h-5 fill-current" />
                             开始生成预览
                         </button>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="flex-1 flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-w-0">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-600">
                                <Code className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800">生成结果预览</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">JSON Output Preview</p>
                            </div>
                        </div>
                        {previewResult && (
                            <button 
                                onClick={handleExport}
                                className="text-xs font-black text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                导出结果
                            </button>
                        )}
                    </div>
                    <div className="flex-1 bg-slate-950 overflow-auto p-8 font-mono text-sm leading-relaxed custom-scrollbar min-h-0">
                        {previewResult ? (
                            <pre className="text-emerald-400 selection:bg-emerald-500/30">
                                {JSON.stringify(previewResult, null, 2)}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-800">
                                <Code className="w-16 h-16 mb-4 opacity-5" />
                                <p className="font-bold opacity-30">生成的数据将在此展示</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
