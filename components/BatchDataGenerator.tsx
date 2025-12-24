
import React, { useState, useCallback, useMemo } from 'react';
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
    path: string; // 存储的是模板路径，如 root.ec.word.usphone
    field: string;
}

interface ListConfig {
    path: string; // 模板路径，如 root.ec.word
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

    // 路径归一化：将 root.ec.word.0.usphone 转换为 root.ec.word.usphone
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
                    className={`flex items-center gap-2 py-1.5 px-3 rounded-xl transition-all group mb-0.5 border
                        ${isList ? 'bg-purple-50 border-purple-200 shadow-sm' : 
                          mappedField ? 'bg-blue-50 border-blue-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    {isObject ? (
                        <button onClick={() => toggleExpand(path)} className="p-1 hover:bg-white rounded-md transition-colors">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-6" />}

                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`font-mono text-sm font-bold ${isList ? 'text-purple-700' : mappedField ? 'text-blue-700' : 'text-slate-600'}`}>{key}</span>
                        <span className="text-slate-300">|</span>
                        
                        {!isObject && (
                            <span className="text-sm text-slate-400 truncate font-mono" title={String(value)}>
                                {typeof value === 'string' ? `"${value}"` : String(value)}
                            </span>
                        )}

                        {isObject && (
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
                            </span>
                        )}
                    </div>

                    {/* 操作区：标记后保持 opacity-100 */}
                    <div className={`flex items-center gap-2 transition-all ${isList || mappedField ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                            onClick={() => toggleList(path)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 border
                                ${isList ? 'bg-purple-600 border-purple-600 text-white shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-purple-400 hover:text-purple-600'}`}
                            title="标记为循环列表项"
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
                            <option value="">Map To Field...</option>
                            {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                </div>

                {isObject && isExpanded && (
                    <div className="border-l-2 border-slate-100 ml-5 my-1">
                        {Object.entries(value).map(([k, v]) => renderNode(k, v, `${path}.${k}`, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    /**
     * 核心逻辑：递归生成数据
     */
    const generateEntries = () => {
        if (!jsonData) return;

        const results: any[] = [];
        const mappingMap = new Map(mappings.map(m => [m.path, m.field]));
        const listSet = new Set(lists.map(l => l.path));

        /**
         * @param data 当前处理的数据
         * @param currentPath 当前实例路径，如 root.ec.word.0
         * @param context 继承自父级的属性上下文
         */
        const walk = (data: any, currentPath: string, context: any) => {
            const nPath = normalizePath(currentPath);
            const isListMarker = listSet.has(nPath);
            const mappedField = mappingMap.get(nPath);

            let currentContext = { ...context };
            
            // 如果当前路径有映射，更新上下文
            if (mappedField) {
                currentContext[mappedField] = data;
            }

            if (isListMarker && data) {
                // 如果当前节点标记为列表，进入循环分支
                const items = Array.isArray(data) ? data : [data];
                items.forEach((item, idx) => {
                    const subPath = Array.isArray(data) ? `${currentPath}.${idx}` : currentPath;
                    // 进入列表后，子项产生的新上下文不应该影响同级其他列表，所以传入 copy
                    processBranch(item, subPath, { ...currentContext });
                });
            } else if (typeof data === 'object' && data !== null) {
                // 普通对象：先扫描所有非列表的同级映射（满足“同级分配”需求）
                const keys = Object.keys(data);
                keys.forEach(k => {
                    const childPath = `${currentPath}.${k}`;
                    const childNPath = normalizePath(childPath);
                    const childMappedField = mappingMap.get(childNPath);
                    const childIsList = listSet.has(childNPath);
                    
                    // 如果子项是普通字段映射且不是列表，则它属于“公共属性”，存入当前 context
                    if (childMappedField && !childIsList && typeof data[k] !== 'object') {
                        currentContext[childMappedField] = data[k];
                    }
                });

                // 然后再递归处理所有子项（包含列表）
                keys.forEach(k => {
                    const childPath = `${currentPath}.${k}`;
                    const childNPath = normalizePath(childPath);
                    const childIsList = listSet.has(childNPath);
                    
                    // 如果子项是列表或对象，则递归
                    if (childIsList || typeof data[k] === 'object') {
                        walk(data[k], childPath, currentContext);
                    }
                });
            }
        };

        /**
         * 处理由 List Item 产生的独立分支
         */
        const processBranch = (data: any, currentPath: string, branchContext: any) => {
            const nPath = normalizePath(currentPath);
            const mappedField = mappingMap.get(nPath);
            if (mappedField) branchContext[mappedField] = data;

            let hasDeepList = false;
            if (typeof data === 'object' && data !== null) {
                // 探测子层级是否还有列表标记
                const keys = Object.keys(data);
                
                // 1. 先收集当前层级的所有直接映射
                keys.forEach(k => {
                    const childPath = `${currentPath}.${k}`;
                    const childNPath = normalizePath(childPath);
                    const f = mappingMap.get(childNPath);
                    if (f && !listSet.has(childNPath)) {
                        branchContext[f] = data[k];
                    }
                });

                // 2. 检查是否有更深层的列表
                for (const k of keys) {
                    const childPath = `${currentPath}.${k}`;
                    if (listSet.has(normalizePath(childPath))) {
                        hasDeepList = true;
                        break;
                    }
                }

                if (hasDeepList) {
                    // 如果有深层列表，继续 walk（这会产生笛卡尔积/双重循环）
                    walk(data, currentPath, branchContext);
                } else {
                    // 没有更深层列表了，说明当前 branchContext 已经是一个完整的条目
                    // 深度遍历当前 data，收集所有遗漏的映射值
                    const collect = (d: any, p: string) => {
                        if (typeof d === 'object' && d !== null) {
                            Object.entries(d).forEach(([k, v]) => {
                                const subP = `${p}.${k}`;
                                const f = mappingMap.get(normalizePath(subP));
                                if (f) branchContext[f] = v;
                                collect(v, subP);
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
            // 自动补全单词：如果用户没映射 text，自动用测试单词填充
            if (!entry.text && testWord) {
                entry.text = testWord;
            }
            // 只要有除 text 以外的映射数据，就认为是有效条目
            if (Object.keys(entry).length > 1 || (entry.text && Object.keys(entry).length > 0)) {
                results.push(entry);
            }
        };

        // 从根节点开始
        walk(jsonData, 'root', {});

        if (results.length === 0) {
            showToast('生成失败：未匹配到任何有效数据。请检查列表标记是否正确。', 'error');
        } else {
            setPreviewResult(results);
            showToast(`成功生成 ${results.length} 条数据`, 'success');
        }
    };

    const handleExport = () => {
        if (!previewResult) return;
        const blob = new Blob([JSON.stringify(previewResult, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `batch_generated_${testWord}_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
                <Logo />
                <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                        <div className="flex items-center px-4 py-1.5 gap-3 border-r border-slate-200">
                            <MapPin className="w-4 h-4 text-blue-500" />
                            <input 
                                value={apiUrl} 
                                onChange={e => setApiUrl(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-96 font-mono font-medium text-slate-700"
                                placeholder="API URL 模板..."
                            />
                        </div>
                        <div className="flex items-center px-4 py-1.5 gap-3">
                            <Code className="w-4 h-4 text-purple-500" />
                            <input 
                                value={testWord} 
                                onChange={e => setTestWord(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-28 font-black text-slate-800"
                                placeholder="测试单词"
                            />
                        </div>
                        <button 
                            onClick={fetchData} 
                            disabled={isFetching}
                            className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-200 flex items-center gap-2 active:scale-95"
                        >
                            {isFetching ? <Send className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            请求并解析
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden max-h-[calc(100vh-80px)]">
                {/* JSON Tree Column */}
                <div className="flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                                <Database className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800">数据结构可视化</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">JSON Tree Mapping</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                                <span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></span> 列表节点
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 flex items-center gap-2 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                <span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span> 字段映射
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6 custom-scrollbar bg-white">
                        {jsonData ? (
                            <div className="space-y-1">
                                {renderNode('ROOT', jsonData, 'root', 0)}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <div className="p-6 bg-slate-50 rounded-full mb-4">
                                    <AlertCircle className="w-12 h-12 opacity-20" />
                                </div>
                                <p className="font-bold">等待数据输入...</p>
                                <p className="text-xs mt-1">请输入 API 路径并点击右上方请求按钮</p>
                            </div>
                        )}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                         <div className="flex gap-8">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">循环层级</span>
                                <span className="text-xl font-black text-purple-600 leading-none mt-1">{lists.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">生效映射</span>
                                <span className="text-xl font-black text-blue-600 leading-none mt-1">{mappings.length}</span>
                            </div>
                         </div>
                         <button 
                            onClick={generateEntries}
                            disabled={!jsonData || (mappings.length === 0 && lists.length === 0)}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center gap-3 disabled:opacity-30 active:scale-95"
                         >
                             <Play className="w-5 h-5 fill-current" />
                             执行数据提取
                         </button>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-0">
                    <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 rounded-xl text-purple-600">
                                <Code className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-800">提取结果预览</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Generated Entries Preview</p>
                            </div>
                        </div>
                        {previewResult && (
                            <button 
                                onClick={handleExport}
                                className="text-xs font-black text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <Download className="w-4 h-4" />
                                导出 JSON 条目
                            </button>
                        )}
                    </div>
                    <div className="flex-1 bg-slate-950 overflow-auto p-8 font-mono text-sm leading-relaxed custom-scrollbar selection:bg-purple-500/30">
                        {previewResult ? (
                            <pre className="text-emerald-400 drop-shadow-sm">
                                {JSON.stringify(previewResult, null, 2)}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-700">
                                <Code className="w-16 h-16 mb-4 opacity-10" />
                                <p className="font-bold">生成的数据将在此展示</p>
                                <p className="text-[10px] mt-1 opacity-50 uppercase tracking-widest">Waiting for extraction...</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
