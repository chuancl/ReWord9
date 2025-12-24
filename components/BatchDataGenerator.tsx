
import React, { useState, useCallback, useMemo } from 'react';
import { Play, Download, Trash2, ChevronRight, ChevronDown, List, MapPin, Database, Send, AlertCircle, HelpCircle, Code, Copy, Check } from 'lucide-react';
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
    path: string;
    field: string;
}

interface ListConfig {
    path: string;
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

    const fetchData = async () => {
        if (!apiUrl.includes('{word}')) {
            showToast('URL 必须包含 {word} 占位符', 'error');
            return;
        }
        setIsFetching(true);
        setJsonData(null);
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

    const isListPath = (path: string) => lists.some(l => l.path === path);
    const getMappingField = (path: string) => mappings.find(m => m.path === path)?.field;

    const toggleList = (path: string) => {
        if (isListPath(path)) setLists(lists.filter(l => l.path !== path));
        else setLists([...lists, { path }]);
    };

    const setMapping = (path: string, field: string) => {
        if (!field) {
            setMappings(mappings.filter(m => m.path !== path));
            return;
        }
        const existing = mappings.find(m => m.path === path);
        if (existing) {
            setMappings(mappings.map(m => m.path === path ? { ...m, field } : m));
        } else {
            setMappings([...mappings, { path, field }]);
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
                    className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-slate-100 transition-colors group ${isList ? 'bg-purple-50 ring-1 ring-purple-200' : ''} ${mappedField ? 'bg-blue-50 ring-1 ring-blue-200' : ''}`}
                    style={{ marginLeft: `${depth * 20}px` }}
                >
                    {isObject ? (
                        <button onClick={() => toggleExpand(path)} className="p-0.5 hover:bg-slate-200 rounded">
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
                        </button>
                    ) : <div className="w-5" />}

                    <span className="font-mono text-sm font-bold text-slate-700">{key}:</span>
                    
                    {!isObject && (
                        <span className="text-sm text-slate-500 truncate max-w-[200px]" title={String(value)}>
                            {typeof value === 'string' ? `"${value}"` : String(value)}
                        </span>
                    )}

                    {isObject && (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded">
                            {Array.isArray(value) ? `Array[${value.length}]` : 'Object'}
                        </span>
                    )}

                    {/* 操作区 */}
                    <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* 列表项标记 */}
                        <button 
                            onClick={() => toggleList(path)}
                            className={`p-1.5 rounded-md text-[10px] font-bold uppercase transition flex items-center gap-1 ${isList ? 'bg-purple-600 text-white' : 'bg-white text-slate-400 border border-slate-200 hover:border-purple-400 hover:text-purple-600'}`}
                            title="标记为循环列表项"
                        >
                            <List className="w-3 h-3" />
                            {isList ? 'List Item' : 'Set List'}
                        </button>

                        {/* 字段映射选择 */}
                        <select 
                            value={mappedField || ''}
                            onChange={(e) => setMapping(path, e.target.value)}
                            className={`text-[10px] font-bold h-7 rounded-md border outline-none transition px-1 ${mappedField ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-400 hover:border-blue-400'}`}
                        >
                            <option value="">Map To...</option>
                            {MAPPING_FIELDS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                        </select>
                    </div>
                </div>

                {isObject && isExpanded && (
                    <div className="border-l border-slate-200 ml-2.5 mt-1">
                        {Object.entries(value).map(([k, v]) => renderNode(k, v, `${path}.${k}`, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    // 核心逻辑：递归生成数据
    const generateEntries = () => {
        if (!jsonData) return;

        const results: any[] = [];
        const mappingMap = new Map(mappings.map(m => [m.path, m.field]));
        const listPaths = lists.map(l => l.path);

        const walk = (data: any, currentPath: string, context: any) => {
            const field = mappingMap.get(currentPath);
            let nextContext = { ...context };
            
            if (field) {
                nextContext[field] = data;
            }

            if (listPaths.includes(currentPath)) {
                // 如果是列表项，处理子集
                const items = Array.isArray(data) ? data : [data];
                items.forEach((item, idx) => {
                    const itemPath = Array.isArray(data) ? `${currentPath}.${idx}` : currentPath;
                    walkChildren(item, itemPath, { ...nextContext });
                });
            } else if (typeof data === 'object' && data !== null) {
                // 普通对象或数组，继续递归
                Object.entries(data).forEach(([k, v]) => {
                    walk(v, `${currentPath}.${k}`, { ...nextContext });
                });
            } else {
                // 叶子节点，且非列表分支，无需特殊处理，context 已经携带了路径上的映射
                // 但如果是叶子节点，我们需要判断是否属于某个完整的 Entry 生成路径
            }
        };

        // 辅助函数：专门处理进入列表项后的生成逻辑
        const walkChildren = (data: any, path: string, itemContext: any) => {
            // 检查当前路径是否有映射
            const field = mappingMap.get(path.replace(/\.\d+$/, '')); // 忽略数组索引部分进行匹配
            if (field) itemContext[field] = data;

            let hasSubList = false;
            if (typeof data === 'object' && data !== null) {
                // 先扫描是否有子列表
                for (const k of Object.keys(data)) {
                    const childPath = `${path}.${k}`;
                    const templatePath = childPath.replace(/\.\d+/g, (m) => isNaN(parseInt(m.slice(1))) ? m : ''); // 这里的路径匹配逻辑需要更健壮

                    // 简化处理：寻找下一个标记为 list 的路径
                    if (listPaths.some(lp => `${path}.${k}`.startsWith(lp) || lp.startsWith(`${path}.${k}`))) {
                        // 包含列表逻辑，继续深挖
                    }
                }

                // 检查当前层级是否有字段映射
                Object.entries(data).forEach(([k, v]) => {
                    const childPath = `${path}.${k}`;
                    // 这里由于嵌套 list 的复杂性，我们采用收集模式：
                    // 如果一个节点下再也没有任何 List 标记了，那么当前收到的 context 就是一个完整的条目
                });
            }
        };

        // --- 方案 B：路径驱动的生成算法 (更适合用户描述的逻辑) ---
        const finalData: any[] = [];
        
        const process = (data: any, currentPath: string, baseObj: any) => {
            // 1. 获取当前路径对应的映射字段
            const templatePath = currentPath.replace(/root\./, '').replace(/\.\d+/g, '');
            const field = mappings.find(m => m.path === currentPath || m.path === `root.${templatePath}`)?.field;
            
            let currentBase = { ...baseObj };
            if (field) {
                currentBase[field] = data;
            }

            // 2. 检查是否是列表点
            const isList = lists.some(l => l.path === currentPath || l.path === `root.${templatePath}`);

            if (isList) {
                const items = Array.isArray(data) ? data : [data];
                items.forEach((item, idx) => {
                    // 进入列表项，每个项都可能产生新的分支
                    const subPath = Array.isArray(data) ? `${currentPath}.${idx}` : currentPath;
                    dive(item, subPath, { ...currentBase });
                });
            } else if (typeof data === 'object' && data !== null) {
                // 非列表节点，将属性分发给子节点
                Object.entries(data).forEach(([k, v]) => {
                    process(v, `${currentPath}.${k}`, currentBase);
                });
            } else {
                // 叶子节点，如果路径上有映射，context 已经处理了
            }
        };

        const dive = (data: any, currentPath: string, entryContext: any) => {
            // 在列表项内部寻找更多列表或映射
            let foundFurtherList = false;
            
            // 递归查找子列表中是否有更多标记
            if (typeof data === 'object' && data !== null) {
                Object.entries(data).forEach(([k, v]) => {
                    const subPath = `${currentPath}.${k}`;
                    const tPath = subPath.replace(/root\./, '').replace(/\.\d+/g, '');
                    if (lists.some(l => l.path === subPath || l.path === `root.${tPath}`)) {
                        foundFurtherList = true;
                        process(v, subPath, entryContext);
                    }
                });

                if (!foundFurtherList) {
                    // 没有更多子列表了，收集当前分支的所有映射
                    const entry = { ...entryContext };
                    const collect = (d: any, p: string) => {
                        const tp = p.replace(/root\./, '').replace(/\.\d+/g, '');
                        const f = mappings.find(m => m.path === p || m.path === `root.${tp}`)?.field;
                        if (f) entry[f] = d;

                        if (typeof d === 'object' && d !== null) {
                            Object.entries(d).forEach(([k, v]) => collect(v, `${p}.${k}`));
                        }
                    };
                    Object.entries(data).forEach(([k, v]) => collect(v, `${currentPath}.${k}`));
                    if (entry.text) finalData.push(entry);
                }
            } else {
                if (entryContext.text) finalData.push(entryContext);
            }
        };

        process(jsonData, 'root', {});
        setPreviewResult(finalData);
        showToast(`生成成功：共 ${finalData.length} 条数据`, 'success');
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
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <div className="flex items-center px-3 py-1.5 gap-2 border-r border-slate-200">
                            <MapPin className="w-4 h-4 text-slate-400" />
                            <input 
                                value={apiUrl} 
                                onChange={e => setApiUrl(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-80 font-mono"
                                placeholder="API URL 模板..."
                            />
                        </div>
                        <div className="flex items-center px-3 py-1.5 gap-2">
                            <Code className="w-4 h-4 text-slate-400" />
                            <input 
                                value={testWord} 
                                onChange={e => setTestWord(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm w-24 font-bold"
                                placeholder="测试单词"
                            />
                        </div>
                        <button 
                            onClick={fetchData} 
                            disabled={isFetching}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-md text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
                        >
                            {isFetching ? <Send className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            请求数据
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* JSON Tree Column */}
                <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Database className="w-5 h-5 text-blue-500" />
                            数据结构映射
                        </h3>
                        <div className="flex gap-2">
                            <div className="text-[10px] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> 列表项 (List Item)
                            </div>
                            <div className="text-[10px] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> 字段映射 (Mapping)
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-6 custom-scrollbar">
                        {jsonData ? (
                            <div className="space-y-1">
                                {renderNode('root', jsonData, 'root', 0)}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <AlertCircle className="w-12 h-12 mb-4 opacity-20" />
                                <p>请先请求数据以开始配置映射规则</p>
                            </div>
                        )}
                    </div>
                    <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center">
                         <div className="flex gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">列表标记</span>
                                <span className="text-sm font-bold text-slate-700">{lists.length}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">映射规则</span>
                                <span className="text-sm font-bold text-slate-700">{mappings.length}</span>
                            </div>
                         </div>
                         <button 
                            onClick={generateEntries}
                            disabled={!jsonData || mappings.length === 0}
                            className="bg-purple-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200 flex items-center gap-2 disabled:opacity-50"
                         >
                             <Play className="w-5 h-5 fill-current" />
                             开始生成预览
                         </button>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Code className="w-5 h-5 text-purple-500" />
                            生成预览 (JSON)
                        </h3>
                        {previewResult && (
                            <button 
                                onClick={handleExport}
                                className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 transition flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                导出结果文件
                            </button>
                        )}
                    </div>
                    <div className="flex-1 bg-slate-900 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar">
                        {previewResult ? (
                            <pre className="text-green-400">
                                {JSON.stringify(previewResult, null, 2)}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600">
                                <Code className="w-12 h-12 mb-4 opacity-20" />
                                <p>生成后的数据将在此展示</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <Toast toast={toast} onClose={() => setToast(null)} />
        </div>
    );
};
