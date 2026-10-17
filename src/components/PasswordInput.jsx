import { useState } from 'react'
import { Eye, EyeOff, Wand2, Copy, Check, CheckCircle2, Circle } from 'lucide-react'
import { INPUT_CLS } from './ui'
import { generatePassword, passwordChecks, passwordStrength } from '../lib/password'

export function PasswordInput({ label, value, onChange, placeholder = '••••••••', autoComplete = 'new-password', show, onToggleShow, tools = false, onGenerate }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }

  return (
    <label className="block">
      <span className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">{label}</span>
        {tools && (
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => onGenerate(generatePassword())}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#1e3a8a] hover:underline">
              <Wand2 size={12} /> Generate
            </button>
            {value && (
              <button type="button" onClick={copy}
                className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800">
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </span>
        )}
      </span>
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className={`${INPUT_CLS} pr-10 ${show ? 'font-mono' : ''}`}
        />
        <button type="button" onClick={onToggleShow} tabIndex={-1} title={show ? 'Hide' : 'Show'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      </div>
    </label>
  )
}

export function StrengthMeter({ value, checklist = true }) {
  const s = passwordStrength(value)
  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="flex-1 grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-1.5 rounded-full transition-colors ${value && s.score >= i ? s.bar : 'bg-gray-100'}`} />
          ))}
        </div>
        <span className={`text-[11px] font-semibold w-14 text-right ${s.text}`}>{s.label}</span>
      </div>
      {checklist && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
          {passwordChecks(value).map(c => (
            <span key={c.label} className={`flex items-center gap-1.5 text-[11px] ${c.ok ? 'text-emerald-600' : 'text-gray-400'}`}>
              {c.ok ? <CheckCircle2 size={12} /> : <Circle size={12} />} {c.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** New password + confirm, with generator, copy, show/hide and strength meter. */
export function NewPasswordFields({ value, confirm, onChange, onConfirm, labels = ['New password', 'Confirm password'], tools = true }) {
  const [show, setShow] = useState(false)
  const mismatch = confirm && value !== confirm
  return (
    <div className="space-y-3">
      <PasswordInput
        label={labels[0]} value={value} onChange={onChange} show={show} onToggleShow={() => setShow(s => !s)}
        tools={tools} onGenerate={pw => { onChange(pw); onConfirm(pw); setShow(true) }}
      />
      <StrengthMeter value={value} />
      <PasswordInput
        label={labels[1]} value={confirm} onChange={onConfirm} show={show} onToggleShow={() => setShow(s => !s)}
      />
      {mismatch && <p className="text-[11px] font-medium text-rose-600 -mt-1">Passwords do not match.</p>}
    </div>
  )
}
