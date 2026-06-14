'use client';

import { useState, useEffect } from 'react';
import { useT } from '@/lib/i18n';

// 编辑弹窗需要的项目字段（设置页 DbProject 的子集即可满足）
interface EditableProject {
  name:        string;
  slug:        string;
  description: string | null;
  color:       string;
  emoji:       string;
}

interface Props {
  project:   EditableProject;            // 待编辑的项目，用来预填表单
  onSuccess: (project: unknown) => void; // 保存成功回调（父组件据此刷新列表）
  onClose:   () => void;                 // 关闭弹窗回调
}

export default function EditProjectDialog({ project, onSuccess, onClose }: Props) {
  const t = useT();

  // 用传入的项目数据预填各个输入框（受控组件）
  const [name,        setName]        = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [emoji,       setEmoji]       = useState(project.emoji);
  const [color,       setColor]       = useState(project.color);

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // 按 Esc 键关闭弹窗（与 NewProjectDialog 保持一致的交互）
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();      // 阻止表单默认提交（否则页面会刷新）
    setError('');
    setSaving(true);

    try {
      // slug 是项目主键、不可修改，所以只 PATCH 可编辑字段
      const res = await fetch(`/api/admin/projects/${project.slug}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name,
          description: description || null, // 空字符串存为 null，语义更准确
          emoji,
          color,
        }),
      });
      const json = await res.json();
      // 不吞错误：后端返回的失败原因直接展示给用户
      if (!json.ok) { setError(json.error ?? 'Error'); setSaving(false); return; }
      onSuccess(json.data);
    } catch {
      setError('Network error');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg text-sm text-white placeholder-[#555566] focus:outline-none focus:border-[#3B82F6]';
  const labelCls = 'text-xs text-[#8B8B9E]';

  return (
    <div className="fixed inset-0 z-50 flex items-start md:items-center justify-center">
      {/* 半透明遮罩：点击空白处关闭 */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full md:max-w-lg h-full md:h-auto md:max-h-[90vh] bg-[#12121A] md:border md:border-[#2A2A3A] md:rounded-xl shadow-2xl flex flex-col">

        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2A3A] shrink-0">
          <h2 className="text-sm font-semibold text-white">{t.adminEditProjectTitle}</h2>
          <button onClick={onClose} className="text-[#8B8B9E] hover:text-white transition-colors text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="space-y-1">
            <label className={labelCls}>{t.adminProjectName}</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className={inputCls} placeholder="My Project" />
          </div>

          {/* slug 只读展示：它是项目主键，不能修改 */}
          <div className="space-y-1">
            <label className={labelCls}>{t.adminProjectSlug}</label>
            <input value={project.slug} disabled
              className={`${inputCls} font-mono opacity-60 cursor-not-allowed`} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>{t.adminProjectEmoji}</label>
              <input value={emoji} onChange={e => setEmoji(e.target.value)}
                className={inputCls} placeholder="📄" />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>{t.adminProjectColor}</label>
              <div className="flex gap-2">
                {/* 原生取色器 + 文本框双向同步，方便直接填 HEX */}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="h-9 w-10 shrink-0 bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg cursor-pointer" />
                <input value={color} onChange={e => setColor(e.target.value)}
                  className={`${inputCls} font-mono`} placeholder="#3B82F6" />
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelCls}>{t.adminProjectDescription}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className={`${inputCls} resize-none`} />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pb-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-[#2A2A3A] text-sm text-[#8B8B9E] hover:text-white hover:border-[#3B3B4A] transition-colors">
              {t.cancel}
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-50 text-sm text-white font-medium transition-colors">
              {saving ? t.adminSaving : t.adminSave}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
