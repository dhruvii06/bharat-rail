import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '../../shared/domain';
import { api } from '../data/api';
import { formatDate, humanize } from './ui';

/** In-app notification channel: unread count in the header, list on click, refreshed every 20 s. */
export function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const box = useRef<HTMLDivElement>(null);

  async function refresh() {
    try { const r = await api.notifications(); setItems(r.items); setUnread(r.unread); } catch { /* keep the last list */ }
  }
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 20000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function openItem(n: Notification) {
    setOpen(false);
    if (!n.read) { await api.readNotification(n.id).catch(() => undefined); void refresh(); }
    if (n.incidentId) navigate(`/incidents/${n.incidentId}`);
  }

  return <div className="notifications" ref={box}>
    <button className="header-button" aria-expanded={open} onClick={() => { setOpen(o => !o); void refresh(); }}>
      Notifications{unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread}</span>}
    </button>
    {open && <div className="dropdown" role="dialog" aria-label="Notifications">
      <div className="dropdown-head"><strong>Notifications</strong>{unread > 0 && <button className="link-button" onClick={async () => { await api.readAllNotifications(); void refresh(); }}>Mark all read</button>}</div>
      {!items.length && <p className="muted">Nothing yet. Updates on your incidents appear here.</p>}
      <ul>{items.map(n => <li key={n.id} className={n.read ? '' : 'unread'}>
        <button onClick={() => void openItem(n)}><span className="type">{humanize(n.type)}</span>{n.message}<small>{formatDate(n.createdAt)}</small></button>
      </li>)}</ul>
    </div>}
  </div>;
}
