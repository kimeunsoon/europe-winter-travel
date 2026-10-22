'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, ArrowUpRight } from 'lucide-react';

type Part = { text: string; annotations?: { type: string; url?: string; title?: string; start_index?: number; end_index?: number }[] };
type Message = { role: 'user' | 'assistant'; content: string; parts?: Part[] };
function sourcedText(part: Part) {
  const marks = (part.annotations || []).filter(a => a.type === 'url_citation' && a.url && /^https?:\/\//.test(a.url) && typeof a.start_index === 'number' && typeof a.end_index === 'number').sort((a,b) => a.start_index! - b.start_index!);
  let cursor = 0;
  const nodes = [];
  for (const [i, mark] of marks.entries()) {
    if (mark.start_index! < cursor) continue;
    nodes.push(part.text.slice(cursor, mark.start_index));
    nodes.push(<a key={i} href={mark.url} target="_blank" rel="noopener noreferrer">[{mark.title || `출처 ${i + 1}`}]</a>);
    cursor = mark.end_index!;
  }
  nodes.push(part.text.slice(cursor));
  return nodes;
}
export default function TravelChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const defaultRequest = '2027년 1월 8일 이후부터 1월 말 사이에 포르투갈 여행을 하고 싶어요. 인원은 2명이고 총예산은 약 1,000만원(1인 약 500만원)입니다. 이 기간 안에 귀국하는 패키지를 추천해 주세요. 출발지와 여행 일수는 상담하며 정하고 싶어요.';
  const [input, setInput] = useState(defaultRequest);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => { if (messages.length || busy) bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [messages, busy]);
  async function send(text: string) {
    if (pending.current || !text.trim()) return;
    pending.current = true; setBusy(true); setError('');
    const next: Message[] = [...messages, { role: 'user', content: text.trim() }];
    setMessages(next); setInput('');
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.map(({role,content}) => ({role,content})) }), signal: AbortSignal.timeout(60000) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '상담을 연결하지 못했습니다.');
      const parts = data.parts as Part[];
      setMessages([...next, { role: 'assistant', content: parts.map(p => p.text).join('\n'), parts }]);
    } catch (e) { setMessages(messages); setInput(text); setError(e instanceof Error && e.name !== 'TimeoutError' ? e.message : '응답이 지연되고 있습니다. 다시 시도해 주세요.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function submit(e: FormEvent) { e.preventDefault(); void send(input); }
  const full = messages.length >= 20;
  return <section id="travel-chat" className="section travel-chat" aria-labelledby="chat-title">
    <div className="section-heading"><div><span className="overline">YOUR PORTUGAL, THIS JANUARY</span><h2 id="chat-title"><MessageCircle size={26}/> 1월의 포르투갈, 나에게 맞게</h2><p>예산과 여행 스타일을 알려주시면 패키지를 찾아 비교해 드려요.</p></div><button className="saved-filter" disabled={busy} onClick={() => { setMessages([]); setInput(''); setError(''); }}>새 상담</button></div>
    <div className="chat-layout"><aside className="chat-intro"><span className="chat-tag">PORTUGAL · JANUARY 2027</span><h3>둘이 떠나는 포르투갈,<br/>여유롭게 준비해요.</h3><p>2027년 1월 8일 이후 ~ 1월 말<br/>2명 · 총예산 약 1,000만원<br/>1인 약 500만원</p><p>출발지와 여행 일수는 상담하며 정해요. 아래 입력 내용은 자유롭게 수정할 수 있어요.</p><small>실제 상품은 검색 출처에서 확인합니다. 가격과 출발 확정 여부는 여행사에서 최종 확인해 주세요.</small></aside>
    <div className="chat-panel"><div className="chat-messages" role="log" aria-live="polite" aria-label="여행 상담 대화" aria-busy={busy}>
      <div className="chat-bubble assistant">안녕하세요! 다가오는 1월 포르투갈 여행을 함께 준비해요. 어디서 출발하시나요? 여행 기간과 1인 예산도 알려주세요.</div>
      {messages.map((m,i) => <div key={i} className={`chat-bubble ${m.role}`}><strong>{m.role === 'user' ? '나' : '포르투갈 여행 도우미'}</strong>{m.parts ? m.parts.map((p,j) => <div key={j}>{sourcedText(p)}</div>) : m.content}</div>)}
      {busy && <div className="chat-bubble assistant" role="status">여행 조건과 최신 정보를 확인하고 있어요…</div>}<div ref={bottom}/></div>
      {!messages.length && <div className="chat-prompts">{['인천 출발, 2명, 1인 300만원으로 8일 여행하고 싶어요.', '50~60대가 걷기 편한 쇼핑 없는 패키지를 찾아주세요.'].map(t => <button key={t} disabled={busy} onClick={() => void send(t)}>{t}</button>)}</div>}
      {error && <p className="chat-error" role="alert">{error} 입력 내용은 보관되어 있어요.</p>}
      {full && <p role="status">상담이 길어졌어요. 새 상담으로 이어가 주세요.</p>}
      <form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="chat-input">여행 상담 메시지</label><textarea id="chat-input" value={input} onChange={e => setInput(e.target.value)} maxLength={4000} rows={2} placeholder="예: 내년 1월, 부부 2명, 7박 9일, 1인 350만원" disabled={busy || full}/><button className="primary" disabled={busy || full || !input.trim()} type="submit">상담하기 <ArrowUpRight size={18}/></button></form><small className="chat-privacy">AI 답변에는 오류가 있을 수 있어요. 여권번호나 결제정보는 입력하지 마세요.</small></div></div>
  </section>;
}
