import { useId } from 'react'
export default function PinkPig() {
  const unique = useId()
  const bodyId = unique + '-body'
  const earId = unique + '-ear'
  return (
    <svg className="pink-pig" viewBox="0 0 260 210" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id={bodyId}
          x1="85"
          y1="36"
          x2="162"
          y2="176"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFE0E5" />
          <stop offset="1" stopColor="#F2A7BB" />
        </linearGradient>
        <linearGradient id={earId} x1="141" y1="28" x2="168" y2="74" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FBD0D9" />
          <stop offset="1" stopColor="#ED9BB2" />
        </linearGradient>
      </defs>
      <ellipse cx="133" cy="188" rx="81" ry="9" fill="#F4E6EA" opacity=".65" />
      <path
        d="M60 99C34 109 29 86 42 82C54 80 54 100 43 101"
        stroke="#DD91A8"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M82 151L86 181C87 187 104 187 106 181L112 163M155 162L161 181C162 187 179 186 181 180L185 145"
        fill="#E99EB4"
        stroke="#DD91A8"
        strokeWidth="2"
      />
      <path
        d="M202 94C194 57 151 39 110 46C61 51 42 84 53 122C63 160 92 173 137 171C178 172 204 153 210 126L222 123V97L202 94Z"
        fill={`url(#${bodyId})`}
        stroke="#E5A1B4"
        strokeWidth="2"
      />
      <path
        d="M148 55C149 38 159 28 176 27C176 44 173 57 166 65"
        fill={`url(#${earId})`}
        stroke="#E5A1B4"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path d="M158 52L168 38L165 58" fill="#E89EB1" />
      <path
        d="M91 61C104 55 120 53 133 55"
        stroke="#D88CA5"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M89 56C103 50 119 49 130 51"
        stroke="#FFF2F4"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="213" cy="110" rx="18" ry="24" fill="#F5B4C5" stroke="#E49FB3" strokeWidth="2" />
      <ellipse cx="209" cy="111" rx="2.5" ry="5" fill="#CE829A" />
      <ellipse cx="219" cy="111" rx="2.5" ry="5" fill="#CE829A" />
      <path d="M166 89Q172 81 179 88" stroke="#765563" strokeWidth="3" strokeLinecap="round" />
      <path d="M169 116Q179 126 188 114" stroke="#BB6B86" strokeWidth="2.7" strokeLinecap="round" />
      <ellipse cx="160" cy="110" rx="10" ry="5.5" fill="#ED8EAB" opacity=".45" />
      <path
        d="M70 93C74 79 86 70 97 68"
        stroke="#FFF1F4"
        strokeWidth="8"
        strokeLinecap="round"
        opacity=".7"
      />
      <circle cx="124" cy="130" r="19" stroke="#F7C5D3" strokeWidth="2" opacity=".7" />
      <path
        d="M124 120V140M129 124C124 118 117 124 122 128C126 130 132 132 126 136C123 138 119 135 119 135"
        stroke="#DFA1B5"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
